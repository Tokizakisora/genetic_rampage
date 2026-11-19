/* Executes the exported battle BKY blocks. Rendering and the demonstration's
 * input sequence are separate from the original program's event logic. */
class BattleVM {
  constructor(program, level = 1, appearance = 1, seed = 17) {
    this.program = program;
    this.level = level;
    this.seed = seed;
    this.time = 0;
    this.queue = [];
    this.alerts = [];
    this.nextScreen = null;
    this.trace = new Set();
    this.globals = {};
    this.components = {};
    this.parents = {};
    this.procedures = {};
    this.events = [];
    this.contacts = new Set();
    this.start = [0, level, level, 0, 0, 0, 0, appearance];
    const add = (component, parent) => {
      const value = {
        X: 0, Y: 0, Width: 10, Height: 10, Visible: true, Enabled: true,
        Speed: 0, Heading: 0, Interval: 100, Radius: 5,
        TimerEnabled: true, TimerInterval: 1000, Picture: '',
        ...component
      };
      delete value.$Components;
      for (const key of Object.keys(value)) {
        if (value[key] === 'True' || value[key] === 'False') value[key] = value[key] === 'True';
        else if (typeof value[key] === 'string' && /^-?\d+(\.\d+)?$/.test(value[key])) value[key] = Number(value[key]);
      }
      if (value.$Type === 'Ball') value.Width = value.Height = value.Radius * 2;
      this.components[value.$Name] = value;
      this.parents[value.$Name] = parent;
      for (const child of component.$Components || []) add(child, value.$Name);
    };
    add(program.scm, null);
    const sizes = {'畫布1': [400,650], '操作區': [400,160], '移動操作': [300,160], '向上': [300,50], '橫向移動': [300,50], '向下': [300,50], '技能列': [100,160]};
    for (const [name, [width,height]] of Object.entries(sizes)) Object.assign(this.components[name], {Width:width, Height:height});
    for (const b of program.blocks) {
      if (b.disabled) continue;
      if (b.t === 'procedures_defnoreturn') this.procedures[b.f.NAME] = b;
      if (b.t === 'component_event') this.events.push(b);
    }
    for (const b of program.blocks) {
      // The project references 暫停狀態 even though its declaration is disabled.
      // Retain the declaration's source value (0) for that referenced variable.
      if (b.t === 'global_declaration') this.globals['global ' + b.f.NAME] = this.evaluate(b.v.VALUE, {});
    }
    this.event('story_fight', 'Initialize');
    this.event('飛行狀態偵測器', 'Timer');
    this.flush();
    for (const component of Object.values(this.components)) {
      component.nextTick = component.$Type === 'Clock' ? component.TimerInterval : component.Interval;
    }
  }

  random() {
    this.seed = (Math.imul(this.seed,1664525) + 1013904223) >>> 0;
    return this.seed / 4294967296;
  }

  get(name, scope) {
    if (name.startsWith('global ')) {
      if (!(name in this.globals)) throw new Error('Missing global ' + name);
      return this.globals[name];
    }
    if (!(name in scope)) throw new Error('Missing variable ' + name);
    return scope[name];
  }

  assign(name, value, scope) {
    if (name.startsWith('global ')) this.globals[name] = value;
    else {
      let owner = scope;
      while (!Object.hasOwn(owner, name) && Object.getPrototypeOf(owner)) owner = Object.getPrototypeOf(owner);
      owner[name] = value;
    }
  }

  componentName(b, scope) {
    return b.m.instance_name || this.evaluate(b.v.COMPONENT, scope);
  }

  evaluate(b, scope) {
    if (!b) throw new Error('Missing expression');
    this.trace.add(b.id);
    const val = name => this.evaluate(b.v[name], scope);
    const all = () => Object.values(b.v).map(x => this.evaluate(x, scope));
    switch (b.t) {
      case 'math_number': return Number(b.f.NUM);
      case 'text': return b.f.TEXT || '';
      case 'helpers_assets': return b.f.ASSET;
      case 'helpers_screen_names': return b.f.SCREEN;
      case 'logic_boolean':
      case 'logic_false': return b.f.BOOL === 'TRUE';
      case 'lexical_variable_get': return this.get(b.f.VAR, scope);
      case 'controls_getStartValue': return this.start;
      case 'component_component_block': return b.m.instance_name;
      case 'component_set_get': return this.components[this.componentName(b,scope)][b.m.property_name];
      case 'lists_create_with': return all();
      case 'lists_select_item': {
        const list = val('LIST'), index = val('NUM') - 1;
        if (!Number.isInteger(index) || index < 0 || index >= list.length) throw new Error('List index ' + (index+1));
        return list[index];
      }
      case 'lists_position_in': return val('LIST').indexOf(val('ITEM')) + 1;
      case 'math_add': return all().reduce((a,v)=>a+v,0);
      case 'math_multiply': return all().reduce((a,v)=>a*v,1);
      case 'math_subtract': return val('A') - val('B');
      case 'math_division': return val('A') / val('B');
      case 'math_power': return val('A') ** val('B');
      case 'math_divide': {
        const a=val('DIVIDEND'), d=val('DIVISOR');
        if (b.f.OP === 'REMAINDER') return a % d;
        if (b.f.OP === 'MODULO') return ((a%d)+d)%d;
        return Math.floor(a/d);
      }
      case 'math_single':
        if (b.f.OP === 'ROOT') return Math.sqrt(val('NUM'));
        throw new Error('Unsupported math operation ' + b.f.OP);
      case 'math_random_int': {
        const from=val('FROM'),to=val('TO');
        return from+Math.floor(this.random()*(to-from+1));
      }
      case 'math_compare':
      case 'logic_compare': {
        const a=val('A'), c=val('B');
        switch(b.f.OP) {
          case 'EQ': return a === c;
          case 'NEQ': return a !== c;
          case 'LT': return a < c;
          case 'LTE': return a <= c;
          case 'GT': return a > c;
          case 'GTE': return a >= c;
          default: throw new Error('Unknown comparison ' + b.f.OP);
        }
      }
      case 'logic_operation':
      case 'logic_or': {
        const expressions=Object.values(b.v);
        return b.f.OP==='AND' ? expressions.every(v=>this.evaluate(v,scope)) : expressions.some(v=>this.evaluate(v,scope));
      }
      case 'text_join': return all().join('');
      default: throw new Error('Unsupported expression ' + b.t + ' ' + b.id);
    }
  }

  execute(first, scope = {}) {
    let b=first;
    while (b) {
      if (b.disabled) { b=b.next; continue; }
      this.trace.add(b.id);
      const val = name=>this.evaluate(b.v[name],scope);
      switch (b.t) {
        case 'lexical_variable_set': this.assign(b.f.VAR,val('VALUE'),scope); break;
        case 'component_set_get': this.set(this.componentName(b,scope),b.m.property_name,val('VALUE')); break;
        case 'controls_if': {
          let matched=false;
          for (const key of Object.keys(b.v)) {
            if (key.startsWith('IF') && val(key)) {
              this.execute(b.s['DO'+key.slice(2)],scope);
              matched=true;
              break;
            }
          }
          if (!matched) this.execute(b.s.ELSE,scope);
          break;
        }
        case 'local_declaration_statement': {
          const local=Object.create(scope);
          for (let i=0; b.f['VAR'+i]!==undefined; i++) local[b.f['VAR'+i]]=val('DECL'+i);
          this.execute(b.s.STACK,local);
          break;
        }
        case 'procedures_callnoreturn': {
          const proc=this.procedures[b.f.PROCNAME];
          if (!proc) throw new Error('Missing procedure ' + b.f.PROCNAME);
          const local={};
          proc.args.forEach((name,i)=>local[name]=val('ARG'+i));
          this.execute(proc.s.STACK,local);
          break;
        }
        case 'lists_replace_item': val('LIST')[val('NUM')-1]=val('ITEM'); break;
        case 'component_method': {
          const name=this.componentName(b,scope), c=this.components[name];
          if (b.m.method_name==='MoveTo') {
            c.X=val('ARG0');c.Y=val('ARG1');this.bound(name);
          } else if (b.m.method_name==='PointInDirection') {
            const x=val('ARG0'),y=val('ARG1');
            c.Heading=-Math.atan2(y-c.Y,x-c.X)*180/Math.PI;
          } else if (b.m.method_name==='ShowAlert') this.alerts.push(val('ARG0'));
          else if (b.m.method_name==='Bounce') {
            const edge=val('ARG0');
            const horizontal=[3,-3,2,-2,4,-4].includes(edge);
            const vertical=[1,-1,2,-2,4,-4].includes(edge);
            if (horizontal) c.Heading=180-c.Heading;
            if (vertical) c.Heading=-c.Heading;
          } else throw new Error('Unsupported method ' + b.m.method_name);
          break;
        }
        case 'controls_openAnotherScreenWithStartValue': this.nextScreen={name:val('SCREENNAME'),value:val('STARTVALUE')}; break;
        default: throw new Error('Unsupported statement ' + b.t + ' ' + b.id);
      }
      b=b.next;
    }
  }

  set(name, property, value) {
    const c=this.components[name];
    const changed=c[property]!==value;
    c[property]=value;
    if (changed && ['Interval','TimerInterval','TimerEnabled','Enabled'].includes(property)) {
      c.nextTick=this.time+(c.$Type==='Clock'?c.TimerInterval:c.Interval);
    }
    if (['X','Y','Width','Height','Picture','Visible'].includes(property)) this.bound(name);
  }

  bound(name) {
    const c=this.components[name], parent=this.components[this.parents[name]];
    if (!parent || parent.$Type!=='Canvas' || !['Ball','ImageSprite'].includes(c.$Type)) return;
    const west=c.X<0,east=c.X+c.Width>parent.Width,north=c.Y<0,south=c.Y+c.Height>parent.Height;
    c.X=Math.max(0,Math.min(c.X,Math.max(0,parent.Width-c.Width)));
    c.Y=Math.max(0,Math.min(c.Y,Math.max(0,parent.Height-c.Height)));
    if (west||east||north||south) {
      const edge=west?(north?-4:south?-2:-3):east?(north?2:south?4:3):north?1:-1;
      this.queue.push({name,event:'EdgeReached',args:{edge}});
    }
  }

  event(name,event,args={}) {
    const c=this.components[name];
    for (const b of this.events) {
      if (b.m.event_name!==event) continue;
      const generic=b.m.is_generic==='true' && b.m.component_type===c.$Type;
      if (generic || b.m.instance_name===name) this.execute(b.s.DO,{...args,component:name,notAlreadyHandled:true});
    }
  }

  flush() {
    let count=0;
    while (this.queue.length) {
      if (++count>500) throw new Error('Event queue did not settle');
      const e=this.queue.shift();this.event(e.name,e.event,e.args);
    }
  }

  collide() {
    const next=new Set();
    const body=this.components['恐龍'],boss=this.components.BOSS;
    for (const [name,c] of Object.entries(this.components)) {
      if (c.$Type!=='Ball' || !c.Visible || !c.Enabled) continue;
      const target=name==='boss子彈_1'?body:boss;
      if (!target.Visible || !target.Enabled) continue;
      const x=c.X+c.Radius,y=c.Y+c.Radius;
      const dx=x-Math.max(target.X,Math.min(x,target.X+target.Width));
      const dy=y-Math.max(target.Y,Math.min(y,target.Y+target.Height));
      if (dx*dx+dy*dy<=c.Radius*c.Radius) {
        const key=name+'|'+target.$Name;next.add(key);
        if (!this.contacts.has(key)) this.queue.push({name,event:'CollidedWith',args:{other:target.$Name}});
      }
    }
    this.contacts=next;
  }

  step(milliseconds) {
    const end=this.time+milliseconds;
    while (this.time<end && !this.nextScreen) {
      this.time=Math.min(end,this.time+2);
      for (const [name,c] of Object.entries(this.components)) {
        if (c.$Type==='Clock' && c.TimerEnabled && this.time>=c.nextTick) {
          c.nextTick=this.time+Math.max(1,c.TimerInterval);
          this.event(name,'Timer');this.flush();
        } else if (['Ball','ImageSprite'].includes(c.$Type) && c.Enabled && c.Speed && this.time>=c.nextTick) {
          c.nextTick=this.time+Math.max(1,c.Interval);
          c.X+=c.Speed*Math.cos(c.Heading*Math.PI/180);
          c.Y-=c.Speed*Math.sin(c.Heading*Math.PI/180);
          this.bound(name);this.flush();
        }
      }
      this.collide();this.flush();
    }
  }

  snapshot() {
    return JSON.parse(JSON.stringify({time:this.time,components:this.components,globals:this.globals,alerts:this.alerts,nextScreen:this.nextScreen}));
  }
}

if (typeof module!=='undefined') module.exports=BattleVM;

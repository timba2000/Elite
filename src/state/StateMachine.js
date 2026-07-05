export class StateMachine {
  constructor() {
    this.current = null;
  }

  change(state, params) {
    if (this.current?.exit) this.current.exit();
    this.current = state;
    if (this.current?.enter) this.current.enter(params);
  }

  update(dt) {
    this.current?.update?.(dt);
  }
}

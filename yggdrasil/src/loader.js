// Simple loading task registry: modules register Promises here and
// callers can await `ready()` to wait for all registered tasks.
export const loading = {
  tasks: [],
  add(promise) {
    if (!promise || typeof promise.then !== 'function') return;
    this.tasks.push(promise);
  },
  ready() {
    return Promise.all(this.tasks);
  }
};

export default loading;

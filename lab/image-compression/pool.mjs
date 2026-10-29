// Workers are terminated after each result, bounding WASM memory as well as
// CPU use. Stale work is cancelled immediately, including synchronous WASM.
export class CompressionPool {
  constructor({ limit, onState, onResult, onError }) {
    Object.assign(this, { limit, onState, onResult, onError });
    this.queue = [];
    this.active = new Map();
  }
  cancel(format) {
    this.queue = this.queue.filter((t) => t.format !== format);
    const running = this.active.get(format);
    if (running) {
      running.worker.terminate();
      clearTimeout(running.timeout);
      this.active.delete(format);
    }
  }
  cancelAll() {
    this.queue = [];
    for (const format of [...this.active.keys()]) this.cancel(format);
  }
  submit(task) {
    this.cancel(task.format);
    task.queuedAt = performance.timeOrigin + performance.now();
    this.queue.push(task);
    this.onState(task.format, "queued");
    this.pump();
  }
  pump() {
    while (this.active.size < this.limit && this.queue.length) {
      const task = this.queue.shift();
      let worker;
      try {
        worker = new Worker(new URL("./worker.mjs", import.meta.url), {
          type: "module",
        });
      } catch (error) {
        this.onError(task, error.message);
        continue;
      }
      const isCurrent = () => this.active.get(task.format)?.worker === worker;
      const finish = () => {
        if (!isCurrent()) return;
        worker.terminate();
        clearTimeout(this.active.get(task.format)?.timeout);
        this.active.delete(task.format);
        this.pump();
      };
      this.active.set(task.format, {
        worker,
        timeout: setTimeout(() => {
          this.onError(
            task,
            "処理が時間内に完了しませんでした。画像サイズを小さくして再試行してください。",
          );
          finish();
        }, 180000),
      });
      this.onState(task.format, "running");
      worker.onmessage = ({ data }) => {
        if (!isCurrent()) return;
        if (data.type === "progress") {
          this.onState(task.format, "matching", data);
          return;
        }
        if (data.type === "result")
          this.onResult(task, {
            ...data,
            totalMs: performance.timeOrigin + performance.now() - task.queuedAt,
          });
        else this.onError(task, data.message);
        finish();
      };
      worker.onerror = () => {
        if (!isCurrent()) return;
        this.onError(
          task,
          "Workerまたはコーデックを読み込めませんでした。ページを再読み込みして再試行してください。",
        );
        finish();
      };
      worker.postMessage(task);
    }
  }
}

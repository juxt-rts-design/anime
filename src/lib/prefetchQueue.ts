const MAX_CONCURRENT = 3;
let active = 0;
const queue: Array<() => Promise<void>> = [];

function drain() {
  while (active < MAX_CONCURRENT && queue.length > 0) {
    active += 1;
    const job = queue.shift()!;
    job()
      .catch(() => undefined)
      .finally(() => {
        active -= 1;
        drain();
      });
  }
}

export function enqueuePrefetch(job: () => Promise<void>) {
  queue.push(job);
  drain();
}

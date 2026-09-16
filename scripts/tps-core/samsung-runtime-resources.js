const fs = require('fs');
/** Read-only cgroup evidence; no command arguments, environment, or secrets. */
function samsungRuntimeResources() {
  const read = (path) => { try { return fs.readFileSync(path, 'utf8').trim(); } catch { return null; } };
  return { measuredAt: new Date().toISOString(),
    pidsCurrent: read('/sys/fs/cgroup/pids.current'), pidsMax: read('/sys/fs/cgroup/pids.max'),
    memoryCurrent: read('/sys/fs/cgroup/memory.current'), memoryMax: read('/sys/fs/cgroup/memory.max') };
}
module.exports = { samsungRuntimeResources };

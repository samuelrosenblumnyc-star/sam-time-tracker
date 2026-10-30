// The "add a to-do" row sits above the list
const { ok, boot, launch, done } = require('./lib.js');
(async () => {
  const b = await launch();
  const todos = { Axon: Array.from({ length: 30 }, (_, i) => ({ id: 'a' + i, task: 'Task ' + i, dueDate: '', dueTime: '', notes: '', priority: 0, done: false })) };
  for (const vp of [{ width: 1280, height: 700 }, { width: 390, height: 800 }]) {
    const p = await boot(b, { store: { stt_config: { defaultClients: ['Axon'], burnRates: [{ id: 'g', label: 'Axon', target: 5, clients: ['Axon'] }] }, stt_todos: todos }, vp });
    await p.click('.app-tab-btn[data-tab="todos"]'); await p.click('.todo-pill >> nth=1'); await p.waitForTimeout(200);
    const pos = await p.evaluate(() => [Math.round(document.querySelector('.add-task-row').getBoundingClientRect().bottom), Math.round(document.querySelector('.todo-table').getBoundingClientRect().top), innerHeight]);
    ok(pos[0] <= pos[1] && pos[0] < pos[2], `${vp.width}px: the add row is above the list and on screen`);
    await p.fill('.add-task-inp', 'Brand new'); await p.keyboard.press('Enter'); await p.waitForTimeout(200);
    ok(await p.evaluate(() => todos.Axon.length) === 31 && await p.evaluate(() => document.activeElement.classList.contains('add-task-inp')), 'adding works and the cursor stays in the box');
    ok(p.errs.length === 0, 'no errors'); await p.ctx.close();
  }
  await done(b);
})();

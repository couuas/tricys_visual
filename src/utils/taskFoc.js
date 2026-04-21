export function getTaskFocConfig(task) {
  const simulation = task?.config_json?.simulation;
  if (!simulation) {
    return null;
  }

  const rawContent = typeof simulation.foc_content === 'string' ? simulation.foc_content : '';
  const content = rawContent.trim();
  if (!content) {
    return null;
  }

  const stopTimeValue = Number(simulation.stop_time);

  return {
    content: rawContent,
    strategy: simulation.foc_strategy || 'table',
    sourceName: simulation.foc_name || 'task_input.foc',
    stopTime: Number.isFinite(stopTimeValue) ? stopTimeValue : null
  };
}

export function hasTaskFoc(task) {
  return Boolean(getTaskFocConfig(task));
}
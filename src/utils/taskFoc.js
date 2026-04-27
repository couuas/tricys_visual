export function getTaskFocConfig(task) {
  const foc = task?.config_json?.foc;
  const simulation = task?.config_json?.simulation;
  if (!foc || !simulation) {
    return null;
  }

  const rawContent = typeof foc.foc_content === 'string' ? foc.foc_content : '';
  const content = rawContent.trim();
  const path = typeof foc.foc_path === 'string' ? foc.foc_path.trim() : '';
  if (!content && !path) {
    return null;
  }

  const stopTimeValue = Number(simulation.stop_time);

  return {
    content: rawContent,
    path,
    hasInlineContent: Boolean(content),
    strategy: 'table',
    sourceName: foc.foc_name || path || 'task_input.foc',
    stopTime: Number.isFinite(stopTimeValue) ? stopTimeValue : null
  };
}

export function hasTaskFoc(task) {
  return Boolean(getTaskFocConfig(task));
}
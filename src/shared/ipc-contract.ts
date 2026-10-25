/**
 * 主进程与渲染进程共用的通道名。两边都从这里取，避免一边写 'schedules:listRange'
 * 一边写 'schedule:listRange' 这种低级错位。
 */
export const CHANNELS = {
  categoriesList: 'categories:list',
  categoriesCreate: 'categories:create',
  categoriesUpdate: 'categories:update',
  categoriesDelete: 'categories:delete',
  schedulesListRange: 'schedules:listRange',
  schedulesGet: 'schedules:get',
  schedulesCreate: 'schedules:create',
  schedulesUpdate: 'schedules:update',
  schedulesDelete: 'schedules:delete',
  periodsList: 'periods:list',
  todoList: 'todo:list',
  tasksCreate: 'tasks:create',
  tasksSetDone: 'tasks:setDone',
  tasksDelete: 'tasks:delete',
  schedulesSetDone: 'schedules:setDone',
  windowSetView: 'window:setView',
  windowMinimize: 'window:minimize',
  windowMaximizeToggle: 'window:maximizeToggle',
  windowIsMaximized: 'window:isMaximized',
  windowCloseToTray: 'window:closeToTray',
} as const;

export type Channel = (typeof CHANNELS)[keyof typeof CHANNELS];
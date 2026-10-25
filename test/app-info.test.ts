import { describe, it, expect } from 'vitest';
import { APP_NAME, APP_USER_MODEL_ID } from '../src/shared/app-info';

describe('app-info', () => {
  it('应用名固定为 AI待办软件', () => {
    expect(APP_NAME).toBe('AI待办软件');
  });
  it('AppUserModelID 用于 Windows 通知归属', () => {
    expect(APP_USER_MODEL_ID).toBe('com.aidaiiban.app');
  });
});

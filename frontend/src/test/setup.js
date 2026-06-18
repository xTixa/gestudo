import '@testing-library/jest-dom/vitest';
import { afterEach, vi } from 'vitest';

afterEach(() => {
    localStorage.clear();
    window.csrfToken = undefined;
    vi.restoreAllMocks();
});

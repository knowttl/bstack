// Exercise platform selection through the production entry point without claiming native OS execution.
Object.defineProperty(process, 'platform', { value: process.env.BSTACK_TEST_PLATFORM })

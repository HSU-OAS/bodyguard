# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: records.spec.ts >> RW-03 actual period filter and invalid input recovery
- Location: e2e/records.spec.ts:347:1

# Error details

```
Error: expect(received).toBe(expected) // Object.is equality

Expected: 202
Received: 403
```

```
Error: page.evaluate: SecurityError: Failed to read the 'localStorage' property from 'Window': Access is denied for this document.
    at UtilityScript.evaluate (<anonymous>:313:16)
    at UtilityScript.<anonymous> (<anonymous>:1:44)
```
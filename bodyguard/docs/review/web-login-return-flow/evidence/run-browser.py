"""FR-U-04: original SQL/API/mail guards unchanged; own production build/config/output."""
import subprocess
import sys

from tests.run_browser import main

original = subprocess.run


def own_build(args, **kwargs):
    if args[:4] == ["pnpm", "exec", "playwright", "test"]:
        assert args[args.index("--config") + 1] == "playwright.account.config.ts"
        args = list(args)
        args[args.index("--config") + 1] = "/private/tmp/bodyguard-login-return.hMIhQq/browser.config.mts"
        args[args.index("--output") + 1] = "/private/tmp/bodyguard-login-return.hMIhQq/browser-results-confirmed"
        kwargs["env"] = {**kwargs["env"], "BODYGUARD_TEST_RECORDS_REPORT": "/private/tmp/bodyguard-login-return.hMIhQq/browser-report-confirmed.json"}
    return original(args, **kwargs)


subprocess.run = own_build
sys.argv = [sys.argv[0], "account", "--grep", "RETURN "]
try:
    raise SystemExit(main())
finally:
    subprocess.run = original

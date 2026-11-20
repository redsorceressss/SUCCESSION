"""Long-running alternative to Task Scheduler: runs the agent loop every 15 minutes."""

from apscheduler.schedulers.blocking import BlockingScheduler
from .run_once import main

if __name__ == "__main__":
    sched = BlockingScheduler()
    sched.add_job(main, "interval", minutes=15)
    print("Agent scheduler started (every 15 minutes). Press Ctrl+C to stop.")
    try:
        sched.start()
    except (KeyboardInterrupt, SystemExit):
        print("Agent scheduler stopped.")

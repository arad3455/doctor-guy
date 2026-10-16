#!/bin/zsh
# Runs the browser tests one by one; a test that dies of a harness timeout (slow machine) gets one retry.
# usage: tools/run-suite.sh [test names…]   (logs in $LOGDIR, default /tmp/doctorguy-tests)
cd "$(dirname "$0")/.."
LOGDIR=${LOGDIR:-/tmp/doctorguy-tests}; mkdir -p $LOGDIR
[ $# -eq 0 ] && set -- playtest mobile-test drive-test stunt-test pier-test downtown-test camp-test harbor-test airport-test gps-test spots-test weather-test photo-test bus-test radio-test caspi-test lakash-test ilan-test lane-test race-test outbreak-test checkup-test frenzy-test zoo-test hospital-test career-test progress-test daynight-test
for t in "$@"; do
  for attempt in 1 2; do
    # a hard limit per test (headless Chrome sometimes stops answering): perl's alarm, since macOS has no `timeout`
    perl -e 'alarm shift; exec @ARGV' ${TEST_LIMIT:-2400} node tools/$t.mjs > $LOGDIR/$t.log 2>&1; code=$?
    [ $code -eq 142 ] && echo 'TimeoutError: hard limit reached' >> $LOGDIR/$t.log
    if grep -q "ProtocolError\|TimeoutError\|Navigation timeout" $LOGDIR/$t.log && [ $attempt = 1 ]; then echo "$t: harness timeout, retrying"; continue; fi
    break
  done
  echo "$t exit $code errors-none:$(grep -c 'ERRORS: none' $LOGDIR/$t.log)"
done

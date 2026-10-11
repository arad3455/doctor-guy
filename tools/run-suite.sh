#!/bin/zsh
# Runs the browser tests one by one; a test that dies of a harness timeout (slow machine) gets one retry.
# usage: tools/run-suite.sh [test names…]   (logs in $LOGDIR, default /tmp/doctorguy-tests)
cd "$(dirname "$0")/.."
LOGDIR=${LOGDIR:-/tmp/doctorguy-tests}; mkdir -p $LOGDIR
TESTS=(${@:-playtest mobile-test drive-test stunt-test pier-test downtown-test camp-test harbor-test gps-test spots-test weather-test checkup-test frenzy-test zoo-test hospital-test career-test progress-test daynight-test})
for t in $TESTS; do
  for attempt in 1 2; do
    node tools/$t.mjs > $LOGDIR/$t.log 2>&1; code=$?
    if grep -q "ProtocolError\|TimeoutError\|Navigation timeout" $LOGDIR/$t.log && [ $attempt = 1 ]; then echo "$t: harness timeout, retrying"; continue; fi
    break
  done
  echo "$t exit $code errors-none:$(grep -c 'ERRORS: none' $LOGDIR/$t.log)"
done

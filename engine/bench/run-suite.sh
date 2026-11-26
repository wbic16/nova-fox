#!/bin/bash
# Nova Fox capacity suite — runs on plain-view, writes results.txt beside it.
cd ~/novafox-bench || exit 1
B=./novafox-bench
R=results.txt
: > $R
run() { echo "### $*" >> $R; /usr/bin/time -v $B "$@" >> $R 2>&1; grep -E "Maximum resident" $R >/dev/null; }
tv() { # phase with /usr/bin/time -v, keeping only bench lines + peak RSS
  echo "### $B $*" >> $R
  /usr/bin/time -v $B "$@" 2>&1 | grep -E "read_to_string|phokenize|explode|spans|offset|replace|write full|raw read|wal:|life:|gen:|Maximum resident" >> $R
}
for MB in 100 250 500; do
  F=world-$MB.phext
  echo "===== $MB MB =====" >> $R
  tv gen $F $MB
  ls -la $F >> $R
  tv scan $F
  tv phokenize $F
  tv explode $F
  tv spans $F
  tv offset $F
  tv replace $F out-$MB.phext
  rm -f out-$MB.phext
done
echo "===== WAL =====" >> $R
rm -f wal.log
tv wal wal.log 1000
ls -la wal.log >> $R
echo "===== LIFE =====" >> $R
tv life 1024 200
tv life 8192 20
tv life 22361 2
echo "===== PYTHON PARSER (500 MB) =====" >> $R
echo "### python3 parse_phext.py world-500.phext" >> $R
/usr/bin/time -v python3 parse_phext.py world-500.phext 2>&1 | grep -E "scroll slots|Maximum resident|Elapsed" >> $R
echo "SUITE DONE" >> $R

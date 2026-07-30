#!/bin/bash
cd /home/nagini/sites/thanks || exit 1
# Pull latest from git
git pull origin main 2>&1 || git pull origin master 2>&1


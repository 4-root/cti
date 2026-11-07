#!/bin/bash
printf 'cti.4root.com.br\n' > CNAME
rm -rf .git
git init -b main

git config user.name "Maarckz"
git config user.email "support.4root@gmail.com"
git config core.sshCommand "ssh -i /home/maarckz/maarckz_4root -o IdentitiesOnly=yes"

git remote add origin git@github.com:4-root/cti.git

git add -A
git status
git commit -m "Deploy do CTI"

git push -u origin main --force

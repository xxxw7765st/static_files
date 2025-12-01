# static_files

## folders

- files: actual data
  - static: long time cached
- web
- public: overwrite files

## branches

- main: config/script/web ...
- data: `files/` changed
- dist: auto ref --hard data head

## event

### auto merge

on push(main)

- rm -rf files/*
- main -> data:

### update info

on push(data)

- cp -Rf public/* files/ : overwrite same-name files
- make info : run script
- cp web files/web
- (last pushing) force push to dist(or deploy)


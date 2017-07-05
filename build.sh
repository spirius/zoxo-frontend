#! /bin/bash

INDEX=index.html

LINE=$(grep -F -n '<!-- ##INJECT## -->' $INDEX | head -n1 | cut -d ':' -f 1)
LINES=$(wc -l $INDEX | awk '{print $1}')

if test -z "$LINE"; then
    echo "Cannot find injection point" >&2
    exit
fi

{
    head -n $((LINE - 1)) $INDEX | grep -v '<script[^>]\+src="\.' | grep -v '<link[^>]\+href="\.'

    echo '<style type="text/css">'
    find . -name "*.css" -type f -print0 | while read -r -d $'\0' file; do
        echo "/* $file */"
        cat $file
    done
    echo '</style>'

    echo '<script type="text/javascript">'
    find . -name "*.js" -type f -print0 | while read -r -d $'\0' file; do
        echo "/* $file */"
        cat $file
        echo ";"
    done
    echo '</script>'

    find partial -name "*.html" -type f -print0 | while read -r -d $'\0' file; do
        echo '<script type="text/ng-template" id="'$file'">'
        cat $file
        echo '</script>'
    done

    tail -n -$((LINES - LINE)) $INDEX | grep -v '<script[^>]\+src="\.' | grep -v '<link[^>]\+href="\.'
} > index.complete.html

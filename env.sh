#!/bin/bash

rm -rf /usr/share/nginx/html/env-config.js
touch /usr/share/nginx/html/env-config.js

echo "window.env = {" >> /usr/share/nginx/html/env-config.js

while read -r line || [[ -n "$line" ]];
do
  if printf '%s\n' "$line" | grep -q -e '='; then
    varname=$(printf '%s\n' "$line" | sed -e 's/=.*//')
    varvalue=$(printf '%s\n' "$line" | sed -e 's/^[^=]*=//')
  fi

  value=$(printf '%s\n' "${!varname}")
  [[ -z $value ]] && value=${varvalue}
  
  echo "  $varname: \"$value\"," >> /usr/share/nginx/html/env-config.js
done < /usr/share/nginx/html/.env

echo "}" >> /usr/share/nginx/html/env-config.js

echo "window.VITE_API_URL = \"$VITE_API_URL\";" >> /usr/share/nginx/html/vite-env.js
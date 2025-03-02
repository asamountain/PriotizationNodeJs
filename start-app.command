#!/bin/bash

# Get the directory where this script is located
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Change to the project directory
cd "$DIR"

# Start the server
node server.js

# The browser opening should now be handled inside server.js
# If there's a line like this, remove it:
# open "http://localhost:3000"
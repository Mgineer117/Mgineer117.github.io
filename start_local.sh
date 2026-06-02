#!/bin/zsh

# Tell the terminal to use the Homebrew Ruby 3.1 instead of the Mac default
export PATH="/opt/homebrew/opt/ruby@3.1/bin:$PATH"

echo "Starting website locally..."
bundle exec jekyll serve --livereload

# Builds the single page that gets published as the Claude artifact.
# It inlines the lobby's local CSS/JS into index.html and drops the document skeleton
# (the artifact host adds its own).  Usage: python3 tools/build-artifact.py <output.html>
import os, re, sys
root = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..') + '/'
s = open(root + 'index.html').read()
s = re.sub(r'<link rel="stylesheet" href="([^":]+\.css)">', lambda m: '<style>\n' + open(root + m.group(1)).read() + '</style>', s)
s = re.sub(r'<script src="([^":]+\.js)"></script>', lambda m: '<script>\n' + open(root + m.group(1)).read() + '</script>', s)
s = re.sub(r'<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport"[^>]*>\n', '', s)
s = s.replace('</head>\n<body>\n', '').replace('</body>\n</html>\n', '')
assert '<title>Level Up</title>' in s[:300] and 'href="games/' not in s and 'src="leaderboard.js' not in s and 'src="games/' not in s
open(sys.argv[1], 'w').write(s)
print(len(s))

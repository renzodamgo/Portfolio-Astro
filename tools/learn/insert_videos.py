"""Insert a «Para entrar en tema» block of YouTube videos into each guide step.

    python3 tools/learn/insert_videos.py tools/learn/videos.json .

videos.json: {"open-2": [{"id": "...", "title": "...", "author": "...", "lang": "inglés", "minutes": 8,
"why": "..."}], ...}. Keys are <guide>-<order>; guide is open or obs. Re-running replaces the block.
"""
import html
import json
import re
import sys
from pathlib import Path

START, END = '<!-- videos:start -->', '<!-- videos:end -->'
FOLDERS = {'open': 'open-strategy', 'obs': 'obstacle-strategy'}


def block(videos):
    items = []
    for v in videos:
        meta = ', '.join(x for x in (v.get('lang'), f"{v['minutes']} min" if v.get('minutes') else None) if x)
        caption = f"<strong>{html.escape(v['title'])}</strong> · {html.escape(v['author'])}"
        caption += f" ({html.escape(meta)})" if meta else ''
        caption += f". {html.escape(v['why'])}" if v.get('why') else ''
        items.append(
            '<figure class="learn-video">\n'
            f'<iframe src="https://www.youtube-nocookie.com/embed/{v["id"]}" title="{html.escape(v["title"])}" '
            'loading="lazy" allow="accelerometer; encrypted-media; gyroscope; picture-in-picture" '
            'referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>\n'
            f'<figcaption>{caption}</figcaption>\n'
            '</figure>')
    return (f'{START}\n## Para entrar en tema\n\n'
            'Si el tema es nuevo para ti, mira esto antes de empezar (no hace falta para seguir el paso).\n\n'
            '<div class="learn-videos">\n' + '\n'.join(items) + '\n</div>\n' + END + '\n\n')


def main():
    data = json.loads(Path(sys.argv[1]).read_text())
    root = Path(sys.argv[2]).expanduser() / 'src/content/learn/steps'
    for key, videos in data.items():
        guide, order = key.split('-')
        for path in (root / FOLDERS[guide]).glob('*.md'):
            text = path.read_text()
            if not re.search(rf'^order: {int(order)}$', text, re.M):
                continue
            text = re.sub(re.escape(START) + r'.*?' + re.escape(END) + r'\n\n', '', text, flags=re.S)
            head, sep, body = text.partition('\n---\n')            # end of the frontmatter
            match = re.search(r'^## ', body, re.M)
            at = match.start() if match else len(body)
            path.write_text(head + sep + body[:at] + block(videos) + body[at:])
            print('videos', key, path.name, len(videos))


if __name__ == '__main__':
    main()

"""Embed each chapter's animated video (remotion/, published to public/learn/videos/open) in its guide page.

    python3 tools/learn/insert_step_videos.py .

The block goes after the chapter's introduction: before the «Para entrar en tema» videos, or before the
first heading. Re-running replaces it.
"""
import subprocess
import sys
from pathlib import Path

START, END = '<!-- step-video:start -->', '<!-- step-video:end -->'


def seconds(mp4):
    out = subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', str(mp4)],
                         capture_output=True, text=True, check=True).stdout
    return round(float(out))


def block(slug, length):
    return (f'{START}\n'
            '<figure class="learn-step-video">\n'
            f'<video controls muted playsinline preload="none" poster="/learn/videos/open/{slug}.jpg">'
            f'<source src="/learn/videos/open/{slug}.mp4" type="video/mp4"></video>\n'
            f'<figcaption>Lo que este capítulo añade a la estrategia, en {length} s de animación sin sonido.'
            '</figcaption>\n'
            f'</figure>\n{END}\n\n')


def main(root):
    videos = root / 'public/learn/videos/open'
    for page in sorted((root / 'src/content/learn/steps/open-strategy').glob('*.md')):
        mp4 = videos / f'{page.stem}.mp4'
        if not mp4.exists():
            continue
        text = page.read_text()
        if START in text:
            text = text[:text.index(START)] + text[text.index(END) + len(END):].lstrip('\n')
        new = block(page.stem, seconds(mp4))
        anchor = '<!-- videos:start -->' if '<!-- videos:start -->' in text else '\n## '
        at = text.index(anchor) + (1 if anchor == '\n## ' else 0)
        page.write_text(text[:at] + new + text[at:])
        print(page.name)


if __name__ == '__main__':
    main(Path(sys.argv[1]))

from django.apps import AppConfig


DEFAULT_BOARDS = [
    ('Memes & Shitposts', '#e74c3c', 0),
    ('Conspiracy Theories', '#3498db', 1),
    ('Rate My Fit', '#2ecc71', 2),
    ('Unpopular Opinions', '#f39c12', 3),
    ('Weird Dreams', '#9b59b6', 4),
    ('Music Drops', '#1abc9c', 5),
    ('Cursed Food', '#e67e22', 6),
    ('Pet Pics', '#ec407a', 7),
]


def seed_boards(sender, **kwargs):
    from .models import Board
    for name, color, order in DEFAULT_BOARDS:
        Board.objects.get_or_create(name=name, defaults={'color': color, 'order': order})


class CoreConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'core'

    def ready(self):
        from django.db.models.signals import post_migrate
        post_migrate.connect(seed_boards, sender=self)

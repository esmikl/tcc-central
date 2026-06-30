from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    display_name = models.CharField(max_length=64, blank=True)
    bio = models.TextField(blank=True)
    # Store as base64 data URL; swap for FileField when moving to S3/etc.
    avatar_data = models.TextField(blank=True)
    banner_data = models.TextField(blank=True)
    anthem_data = models.TextField(blank=True)
    anthem_name = models.CharField(max_length=200, blank=True)

    class Meta:
        db_table = 'core_user'

    def to_dict(self):
        return {
            'id': self.id,
            'username': self.username,
            'display_name': self.display_name or self.username,
            'bio': self.bio,
            'avatar_data': self.avatar_data,
            'banner_data': self.banner_data,
            'anthem_name': self.anthem_name,
            'date_joined': self.date_joined.isoformat(),
            'post_count': self.posts.count(),
            'follower_count': self.followers.count(),
            'following_count': self.following.count(),
        }


class Board(models.Model):
    name = models.CharField(max_length=100, unique=True)
    color = models.CharField(max_length=20, default='#e74c3c')
    order = models.IntegerField(default=0)

    class Meta:
        ordering = ['order', 'name']

    def __str__(self):
        return self.name


class Post(models.Model):
    board = models.ForeignKey(Board, on_delete=models.CASCADE, related_name='posts')
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='posts')
    text = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def like_count(self):
        return self.post_likes.count()

    def to_dict(self, request_user=None):
        return {
            'id': self.id,
            'board': self.board.name,
            'user': self.user.display_name or self.user.username,
            'username': self.user.username,
            'text': self.text,
            'time': self.created_at.strftime('%-m/%-d/%y'),
            'likes': self.like_count(),
            'liked': self.post_likes.filter(user=request_user).exists() if request_user and request_user.is_authenticated else False,
            'comments': self.replies.count(),
            'replies': [r.to_dict() for r in self.replies.all()],
        }


class PostLike(models.Model):
    post = models.ForeignKey(Post, on_delete=models.CASCADE, related_name='post_likes')
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='post_likes')

    class Meta:
        unique_together = ('post', 'user')


class Reply(models.Model):
    post = models.ForeignKey(Post, on_delete=models.CASCADE, related_name='replies')
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='replies')
    text = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['created_at']

    def to_dict(self):
        return {
            'id': self.id,
            'user': self.user.display_name or self.user.username,
            'username': self.user.username,
            'text': self.text,
            'time': self.created_at.strftime('%-m/%-d/%y'),
        }


class ChatMessage(models.Model):
    channel = models.CharField(max_length=50)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='chat_messages')
    text = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['created_at']

    def to_dict(self):
        return {
            'id': self.id,
            'channel': self.channel,
            'user': self.user.display_name or self.user.username,
            'username': self.user.username,
            'text': self.text,
            'time': self.created_at.strftime('%-m/%-d/%y %-I:%M %p'),
        }


class DirectMessage(models.Model):
    sender = models.ForeignKey(User, on_delete=models.CASCADE, related_name='sent_dms')
    recipient = models.ForeignKey(User, on_delete=models.CASCADE, related_name='received_dms')
    text = models.TextField()
    read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['created_at']

    def to_dict(self):
        return {
            'id': self.id,
            'sender': self.sender.display_name or self.sender.username,
            'sender_username': self.sender.username,
            'recipient': self.recipient.display_name or self.recipient.username,
            'recipient_username': self.recipient.username,
            'text': self.text,
            'read': self.read,
            'time': self.created_at.strftime('%-m/%-d/%y %-I:%M %p'),
        }


class Reel(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='reels')
    caption = models.CharField(max_length=200, blank=True)
    emoji = models.CharField(max_length=10, default='🔥')
    bg = models.CharField(max_length=200, default='linear-gradient(135deg, #e74c3c, #8e44ad)')
    sound = models.CharField(max_length=100, default='Original Audio')
    likes = models.IntegerField(default=0)
    comments = models.IntegerField(default=0)
    shares = models.IntegerField(default=0)
    media = models.FileField(upload_to='reels/', blank=True, null=True)
    media_type = models.CharField(max_length=10, blank=True, choices=[('video', 'Video'), ('image', 'Image')])
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def to_dict(self, request=None):
        media_url = None
        if self.media and request:
            media_url = request.build_absolute_uri(self.media.url)
        elif self.media:
            media_url = self.media.url
        return {
            'id': self.id,
            'user': self.user.display_name or self.user.username,
            'username': self.user.username,
            'caption': self.caption,
            'emoji': self.emoji,
            'bg': self.bg,
            'sound': self.sound,
            'likes': self.likes,
            'comments': self.comments,
            'shares': self.shares,
            'media_url': media_url,
            'media_type': self.media_type,
            'created_at': self.created_at.isoformat(),
        }


class Notification(models.Model):
    TYPE_CHOICES = [
        ('like', 'Like'),
        ('reply', 'Reply'),
        ('mention', 'Mention'),
        ('follow', 'Follow'),
    ]
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='notifications')
    type = models.CharField(max_length=20, choices=TYPE_CHOICES)
    message = models.TextField()
    read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def to_dict(self):
        return {
            'id': self.id,
            'type': self.type,
            'message': self.message,
            'read': self.read,
            'created_at': self.created_at.isoformat(),
        }


class Follow(models.Model):
    follower = models.ForeignKey(User, on_delete=models.CASCADE, related_name='following')
    following = models.ForeignKey(User, on_delete=models.CASCADE, related_name='followers')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('follower', 'following')

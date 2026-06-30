from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from .models import User, Board, Post, Reply, PostLike, ChatMessage, DirectMessage, Reel, Notification, Follow


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    list_display = ('username', 'display_name', 'email', 'is_staff', 'date_joined')
    fieldsets = BaseUserAdmin.fieldsets + (
        ('TCC Profile', {'fields': ('display_name', 'bio', 'anthem_name')}),
    )


@admin.register(Board)
class BoardAdmin(admin.ModelAdmin):
    list_display = ('name', 'color', 'order', 'post_count')
    ordering = ('order',)

    def post_count(self, obj):
        return obj.posts.count()


@admin.register(Post)
class PostAdmin(admin.ModelAdmin):
    list_display = ('user', 'board', 'text_preview', 'like_count', 'reply_count', 'created_at')
    list_filter = ('board',)
    search_fields = ('text', 'user__username')
    raw_id_fields = ('user', 'board')

    def text_preview(self, obj):
        return obj.text[:60] + ('…' if len(obj.text) > 60 else '')

    def like_count(self, obj):
        return obj.post_likes.count()

    def reply_count(self, obj):
        return obj.replies.count()


@admin.register(Reply)
class ReplyAdmin(admin.ModelAdmin):
    list_display = ('user', 'post', 'text_preview', 'created_at')
    raw_id_fields = ('user', 'post')

    def text_preview(self, obj):
        return obj.text[:60] + ('…' if len(obj.text) > 60 else '')


@admin.register(ChatMessage)
class ChatMessageAdmin(admin.ModelAdmin):
    list_display = ('user', 'channel', 'text_preview', 'created_at')
    list_filter = ('channel',)

    def text_preview(self, obj):
        return obj.text[:60] + ('…' if len(obj.text) > 60 else '')


@admin.register(DirectMessage)
class DirectMessageAdmin(admin.ModelAdmin):
    list_display = ('sender', 'recipient', 'text_preview', 'read', 'created_at')
    list_filter = ('read',)

    def text_preview(self, obj):
        return obj.text[:60] + ('…' if len(obj.text) > 60 else '')


@admin.register(Reel)
class ReelAdmin(admin.ModelAdmin):
    list_display = ('user', 'caption', 'likes', 'comments', 'shares', 'created_at')


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = ('user', 'type', 'message', 'read', 'created_at')
    list_filter = ('type', 'read')


@admin.register(Follow)
class FollowAdmin(admin.ModelAdmin):
    list_display = ('follower', 'following', 'created_at')
    raw_id_fields = ('follower', 'following')

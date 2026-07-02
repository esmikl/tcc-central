from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from .models import User, Board, Post, Reply, PostLike, ChatMessage, DirectMessage, Reel, Notification, Follow, Quote


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    list_display = ('username', 'display_name', 'email', 'is_staff', 'is_active', 'agreed_to_terms', 'last_login_ip', 'date_joined')
    search_fields = BaseUserAdmin.search_fields + ('registration_ip', 'last_login_ip')
    fieldsets = BaseUserAdmin.fieldsets + (
        ('TCC Profile', {'fields': ('display_name', 'bio', 'anthem_name')}),
        ('Terms and Conditions', {'fields': ('agreed_to_terms', 'terms_accepted_at')}),
        ('IP Tracking (abuse / law-enforcement requests only)', {'fields': ('registration_ip', 'last_login_ip')}),
    )


@admin.register(Board)
class BoardAdmin(admin.ModelAdmin):
    list_display = ('name', 'color', 'order', 'post_count')
    ordering = ('order',)

    def post_count(self, obj):
        return obj.posts.count()


@admin.register(Post)
class PostAdmin(admin.ModelAdmin):
    list_display = ('user', 'board', 'text_preview', 'like_count', 'reply_count', 'ip_address', 'created_at')
    list_filter = ('board',)
    search_fields = ('text', 'user__username', 'ip_address')
    raw_id_fields = ('user', 'board')

    def text_preview(self, obj):
        return obj.text[:60] + ('…' if len(obj.text) > 60 else '')

    def like_count(self, obj):
        return obj.post_likes.count()

    def reply_count(self, obj):
        return obj.replies.count()


@admin.register(Reply)
class ReplyAdmin(admin.ModelAdmin):
    list_display = ('user', 'post', 'text_preview', 'ip_address', 'created_at')
    search_fields = ('text', 'user__username', 'ip_address')
    raw_id_fields = ('user', 'post')

    def text_preview(self, obj):
        return obj.text[:60] + ('…' if len(obj.text) > 60 else '')


@admin.register(ChatMessage)
class ChatMessageAdmin(admin.ModelAdmin):
    list_display = ('user', 'channel', 'text_preview', 'ip_address', 'created_at')
    list_filter = ('channel',)
    search_fields = ('text', 'user__username', 'ip_address')

    def text_preview(self, obj):
        return obj.text[:60] + ('…' if len(obj.text) > 60 else '')


@admin.register(DirectMessage)
class DirectMessageAdmin(admin.ModelAdmin):
    list_display = ('sender', 'recipient', 'text_preview', 'read', 'ip_address', 'created_at')
    list_filter = ('read',)
    search_fields = ('text', 'sender__username', 'recipient__username', 'ip_address')

    def text_preview(self, obj):
        return obj.text[:60] + ('…' if len(obj.text) > 60 else '')


@admin.register(Reel)
class ReelAdmin(admin.ModelAdmin):
    list_display = ('user', 'caption', 'likes', 'comments', 'shares', 'ip_address', 'created_at')
    search_fields = ('caption', 'user__username', 'ip_address')


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = ('user', 'type', 'message', 'read', 'created_at')
    list_filter = ('type', 'read')


@admin.register(Follow)
class FollowAdmin(admin.ModelAdmin):
    list_display = ('follower', 'following', 'created_at')
    raw_id_fields = ('follower', 'following')


@admin.register(Quote)
class QuoteAdmin(admin.ModelAdmin):
    list_display = ('text', 'order', 'created_at')
    ordering = ('order',)

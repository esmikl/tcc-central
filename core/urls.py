from django.urls import path
from . import views

urlpatterns = [
    # Frontend
    path('', views.index, name='index'),
    path('terms/', views.terms_page, name='terms'),
    path('admin-dashboard/', views.admin_dashboard_page, name='admin_dashboard'),

    # Auth
    path('api/register', views.register, name='register'),
    path('api/login', views.login_view, name='login'),
    path('api/logout', views.logout_view, name='logout'),
    path('api/me', views.me_view, name='me'),

    # Profile
    path('api/profile', views.profile_view, name='profile'),
    path('api/profile/password', views.change_password, name='change_password'),

    # Boards & Posts
    path('api/boards/', views.boards, name='boards'),
    path('api/boards/<int:board_id>/', views.board_detail, name='board_detail'),
    path('api/boards/<int:board_id>/posts/', views.board_posts, name='board_posts'),
    path('api/posts/<int:post_id>/', views.post_detail, name='post_detail'),
    path('api/posts/<int:post_id>/like/', views.post_like, name='post_like'),
    path('api/posts/<int:post_id>/replies/', views.post_replies, name='post_replies'),

    # Quotes
    path('api/quotes/', views.quotes_list, name='quotes_list'),

    # Chat
    path('api/chat/<str:channel>/messages/', views.channel_messages, name='channel_messages'),

    # Direct Messages
    path('api/dms/', views.dm_conversations, name='dm_conversations'),
    path('api/dms/<str:username>/', views.direct_messages, name='direct_messages'),

    # Reels
    path('api/reels/', views.reels, name='reels'),
    path('api/reels/<int:reel_id>/like/', views.reel_like, name='reel_like'),

    # Users
    path('api/users/<str:username>/', views.user_profile, name='user_profile'),
    path('api/users/<str:username>/posts/', views.user_posts, name='user_posts'),
    path('api/users/<str:username>/reels/', views.user_reels, name='user_reels'),
    path('api/users/<str:username>/follow/', views.follow_user, name='follow_user'),

    # Notifications
    path('api/notifications/', views.notifications_view, name='notifications'),
    path('api/notifications/read/', views.notifications_read, name='notifications_read'),

    # Admin
    path('api/admin/users/', views.admin_users, name='admin_users'),
    path('api/admin/users/<str:username>/ban/', views.admin_ban_user, name='admin_ban_user'),
    path('api/admin/users/<str:username>/toggle-staff/', views.admin_toggle_staff, name='admin_toggle_staff'),
    path('api/admin/posts/', views.admin_posts, name='admin_posts'),
    path('api/admin/quotes/', views.admin_quotes, name='admin_quotes'),
    path('api/admin/quotes/<int:quote_id>/', views.admin_quote_detail, name='admin_quote_detail'),
]

import json
import re
from django.contrib.auth import authenticate
from django.contrib.auth import login as auth_login
from django.contrib.auth import logout as auth_logout
from django.http import JsonResponse
from django.shortcuts import render, get_object_or_404
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_GET

from .models import (
    User, Board, Post, PostLike, Reply,
    ChatMessage, DirectMessage, Reel, Notification, Follow,
)


# ── Helpers ───────────────────────────────────────────────────────────────────

def _json_body(request):
    try:
        return json.loads(request.body), None
    except (json.JSONDecodeError, UnicodeDecodeError):
        return None, JsonResponse({'error': 'Invalid JSON'}, status=400)


def _require_auth(request):
    if not request.user.is_authenticated:
        return JsonResponse({'error': 'Authentication required'}, status=401)
    return None


def _method_not_allowed():
    return JsonResponse({'error': 'Method not allowed'}, status=405)


# ── Frontend entry point ──────────────────────────────────────────────────────

def index(request):
    return render(request, 'core/index.html')


# ── Auth endpoints ────────────────────────────────────────────────────────────

@csrf_exempt
def register(request):
    if request.method != 'POST':
        return _method_not_allowed()

    data, err = _json_body(request)
    if err:
        return err

    username = data.get('username', '').strip().lower()
    display_name = data.get('display_name', '').strip()
    password = data.get('password', '')

    if not username:
        return JsonResponse({'error': 'Username is required'}, status=400)
    if not re.match(r'^[a-zA-Z0-9_]{2,32}$', username):
        return JsonResponse({'error': 'Username must be 2–32 characters (letters, numbers, underscores only)'}, status=400)
    if len(password) < 8:
        return JsonResponse({'error': 'Password must be at least 8 characters'}, status=400)
    if User.objects.filter(username__iexact=username).exists():
        return JsonResponse({'error': 'Username is already taken'}, status=400)

    user = User.objects.create_user(
        username=username,
        password=password,
        display_name=display_name or username,
    )
    auth_login(request, user)
    return JsonResponse({'user': user.to_dict()}, status=201)


@csrf_exempt
def login_view(request):
    if request.method != 'POST':
        return _method_not_allowed()

    data, err = _json_body(request)
    if err:
        return err

    username = data.get('username', '').strip()
    password = data.get('password', '')

    if not username or not password:
        return JsonResponse({'error': 'Username and password are required'}, status=400)

    user = authenticate(request, username=username, password=password)
    if user is None:
        return JsonResponse({'error': 'Invalid username or password'}, status=401)

    auth_login(request, user)
    return JsonResponse({'user': user.to_dict()})


@csrf_exempt
def logout_view(request):
    if request.method != 'POST':
        return _method_not_allowed()
    auth_logout(request)
    return JsonResponse({'ok': True})


def me_view(request):
    if not request.user.is_authenticated:
        return JsonResponse({'error': 'Not authenticated'}, status=401)
    return JsonResponse({'user': request.user.to_dict()})


# ── Profile ───────────────────────────────────────────────────────────────────

@csrf_exempt
def profile_view(request):
    err = _require_auth(request)
    if err:
        return err

    if request.method == 'GET':
        return JsonResponse({'user': request.user.to_dict()})

    if request.method == 'PUT':
        data, err = _json_body(request)
        if err:
            return err

        user = request.user
        if 'display_name' in data:
            user.display_name = data['display_name'].strip()
        if 'bio' in data:
            user.bio = data['bio'].strip()
        if 'avatar_data' in data:
            user.avatar_data = data['avatar_data']
        if 'banner_data' in data:
            user.banner_data = data['banner_data']
        if 'anthem_data' in data:
            user.anthem_data = data['anthem_data']
        if 'anthem_name' in data:
            user.anthem_name = data['anthem_name']
        user.save()
        return JsonResponse({'user': user.to_dict()})

    return _method_not_allowed()


@csrf_exempt
def change_password(request):
    err = _require_auth(request)
    if err:
        return err
    if request.method != 'POST':
        return _method_not_allowed()

    data, err = _json_body(request)
    if err:
        return err

    current = data.get('current_password', '')
    new_pw = data.get('new_password', '')

    if not request.user.check_password(current):
        return JsonResponse({'error': 'Current password is incorrect'}, status=400)
    if len(new_pw) < 8:
        return JsonResponse({'error': 'New password must be at least 8 characters'}, status=400)

    request.user.set_password(new_pw)
    request.user.save()
    auth_login(request, request.user)
    return JsonResponse({'ok': True})


# ── Boards ────────────────────────────────────────────────────────────────────

@csrf_exempt
def boards(request):
    if request.method == 'GET':
        board_list = Board.objects.all()
        return JsonResponse({
            'boards': [
                {
                    'id': b.id,
                    'name': b.name,
                    'color': b.color,
                    'post_count': b.posts.count(),
                }
                for b in board_list
            ]
        })

    if request.method == 'POST':
        err = _require_auth(request)
        if err:
            return err
        data, err = _json_body(request)
        if err:
            return err

        name = data.get('name', '').strip()
        color = data.get('color', '#e74c3c')
        if not name:
            return JsonResponse({'error': 'Board name is required'}, status=400)
        if Board.objects.filter(name__iexact=name).exists():
            return JsonResponse({'error': 'A board with that name already exists'}, status=400)

        board = Board.objects.create(
            name=name,
            color=color,
            order=Board.objects.count(),
        )
        return JsonResponse({'board': {'id': board.id, 'name': board.name, 'color': board.color}}, status=201)

    return _method_not_allowed()


@csrf_exempt
def board_posts(request, board_id):
    board = get_object_or_404(Board, pk=board_id)

    if request.method == 'GET':
        posts = board.posts.select_related('user').prefetch_related('replies__user', 'post_likes')
        return JsonResponse({'posts': [p.to_dict(request.user) for p in posts]})

    if request.method == 'POST':
        err = _require_auth(request)
        if err:
            return err
        data, err = _json_body(request)
        if err:
            return err

        text = data.get('text', '').strip()
        if not text:
            return JsonResponse({'error': 'Post text is required'}, status=400)

        post = Post.objects.create(board=board, user=request.user, text=text)
        return JsonResponse({'post': post.to_dict(request.user)}, status=201)

    return _method_not_allowed()


@csrf_exempt
def post_detail(request, post_id):
    post = get_object_or_404(Post, pk=post_id)

    if request.method == 'GET':
        return JsonResponse({'post': post.to_dict(request.user)})

    if request.method == 'DELETE':
        err = _require_auth(request)
        if err:
            return err
        if post.user != request.user and not request.user.is_staff:
            return JsonResponse({'error': 'You can only delete your own posts'}, status=403)
        post.delete()
        return JsonResponse({'ok': True})

    return _method_not_allowed()


@csrf_exempt
def post_like(request, post_id):
    err = _require_auth(request)
    if err:
        return err
    if request.method != 'POST':
        return _method_not_allowed()

    post = get_object_or_404(Post, pk=post_id)
    like, created = PostLike.objects.get_or_create(post=post, user=request.user)
    if not created:
        like.delete()
        liked = False
    else:
        liked = True

    return JsonResponse({'liked': liked, 'likes': post.like_count()})


@csrf_exempt
def post_replies(request, post_id):
    post = get_object_or_404(Post, pk=post_id)

    if request.method == 'GET':
        return JsonResponse({'replies': [r.to_dict() for r in post.replies.select_related('user')]})

    if request.method == 'POST':
        err = _require_auth(request)
        if err:
            return err
        data, err = _json_body(request)
        if err:
            return err

        text = data.get('text', '').strip()
        if not text:
            return JsonResponse({'error': 'Reply text is required'}, status=400)

        reply = Reply.objects.create(post=post, user=request.user, text=text)

        # notify post author if it's not the same user
        if post.user != request.user:
            Notification.objects.create(
                user=post.user,
                type='reply',
                message=f'{request.user.display_name or request.user.username} replied to your post.',
            )

        return JsonResponse({'reply': reply.to_dict()}, status=201)

    return _method_not_allowed()


# ── Chat ──────────────────────────────────────────────────────────────────────

VALID_CHANNELS = {'general', 'off-topic', 'music', 'gaming', 'memes'}


@csrf_exempt
def channel_messages(request, channel):
    if channel not in VALID_CHANNELS:
        return JsonResponse({'error': 'Unknown channel'}, status=404)

    if request.method == 'GET':
        msgs = ChatMessage.objects.filter(channel=channel).select_related('user').order_by('created_at')[:200]
        return JsonResponse({'messages': [m.to_dict() for m in msgs]})

    if request.method == 'POST':
        err = _require_auth(request)
        if err:
            return err
        data, err = _json_body(request)
        if err:
            return err

        text = data.get('text', '').strip()
        if not text:
            return JsonResponse({'error': 'Message text is required'}, status=400)
        if len(text) > 2000:
            return JsonResponse({'error': 'Message too long (max 2000 characters)'}, status=400)

        msg = ChatMessage.objects.create(channel=channel, user=request.user, text=text)
        return JsonResponse({'message': msg.to_dict()}, status=201)

    return _method_not_allowed()


# ── Direct Messages ───────────────────────────────────────────────────────────

@csrf_exempt
def direct_messages(request, username):
    err = _require_auth(request)
    if err:
        return err

    other = get_object_or_404(User, username__iexact=username)

    if request.method == 'GET':
        from django.db.models import Q
        msgs = DirectMessage.objects.filter(
            Q(sender=request.user, recipient=other) | Q(sender=other, recipient=request.user)
        ).select_related('sender', 'recipient').order_by('created_at')
        # mark incoming as read
        msgs.filter(sender=other, read=False).update(read=True)
        return JsonResponse({'messages': [m.to_dict() for m in msgs]})

    if request.method == 'POST':
        data, err = _json_body(request)
        if err:
            return err

        text = data.get('text', '').strip()
        if not text:
            return JsonResponse({'error': 'Message text is required'}, status=400)

        msg = DirectMessage.objects.create(sender=request.user, recipient=other, text=text)
        return JsonResponse({'message': msg.to_dict()}, status=201)

    return _method_not_allowed()


def dm_conversations(request):
    err = _require_auth(request)
    if err:
        return err

    from django.db.models import Q, Max
    user = request.user
    partner_ids = DirectMessage.objects.filter(
        Q(sender=user) | Q(recipient=user)
    ).values_list('sender_id', 'recipient_id')

    seen = set()
    for s, r in partner_ids:
        other = r if s == user.id else s
        seen.add(other)

    partners = User.objects.filter(id__in=seen)
    result = []
    for p in partners:
        unread = DirectMessage.objects.filter(sender=p, recipient=user, read=False).count()
        result.append({'username': p.username, 'display_name': p.display_name or p.username, 'unread': unread})

    return JsonResponse({'conversations': result})


# ── Reels ─────────────────────────────────────────────────────────────────────

@csrf_exempt
def reels(request):
    if request.method == 'GET':
        reel_list = Reel.objects.select_related('user').all()
        return JsonResponse({'reels': [r.to_dict(request) for r in reel_list]})

    if request.method == 'POST':
        err = _require_auth(request)
        if err:
            return err

        caption = request.POST.get('caption', '').strip()
        emoji = request.POST.get('emoji', '🔥')
        bg = request.POST.get('bg', 'linear-gradient(135deg, #e74c3c, #8e44ad)')
        sound = request.POST.get('sound', 'Original Audio')

        reel = Reel(user=request.user, caption=caption, emoji=emoji, bg=bg, sound=sound)

        media_file = request.FILES.get('media')
        if media_file:
            reel.media = media_file
            reel.media_type = 'video' if media_file.content_type.startswith('video/') else 'image'

        reel.save()
        return JsonResponse({'reel': reel.to_dict(request)}, status=201)

    return _method_not_allowed()


@csrf_exempt
def reel_like(request, reel_id):
    err = _require_auth(request)
    if err:
        return err
    if request.method != 'POST':
        return _method_not_allowed()

    reel = get_object_or_404(Reel, pk=reel_id)
    # Simple toggle stored on the model (no per-user like tracking yet)
    reel.likes += 1
    reel.save(update_fields=['likes'])
    return JsonResponse({'likes': reel.likes})


# ── User profiles ─────────────────────────────────────────────────────────────

@require_GET
def user_profile(request, username):
    user = get_object_or_404(User, username__iexact=username)
    data = user.to_dict()
    if request.user.is_authenticated and request.user != user:
        data['is_following'] = Follow.objects.filter(follower=request.user, following=user).exists()
    else:
        data['is_following'] = False
    return JsonResponse({'user': data})


@require_GET
def user_posts(request, username):
    user = get_object_or_404(User, username__iexact=username)
    posts = user.posts.select_related('board').prefetch_related('replies', 'post_likes')
    return JsonResponse({'posts': [p.to_dict(request.user) for p in posts]})


@require_GET
def user_reels(request, username):
    user = get_object_or_404(User, username__iexact=username)
    reel_list = user.reels.all()
    return JsonResponse({'reels': [r.to_dict(request) for r in reel_list]})


@csrf_exempt
def follow_user(request, username):
    err = _require_auth(request)
    if err:
        return err
    if request.method != 'POST':
        return _method_not_allowed()

    target = get_object_or_404(User, username__iexact=username)
    if target == request.user:
        return JsonResponse({'error': "You can't follow yourself"}, status=400)

    follow, created = Follow.objects.get_or_create(follower=request.user, following=target)
    if not created:
        follow.delete()
        following = False
    else:
        following = True
        Notification.objects.create(
            user=target,
            type='follow',
            message=f'{request.user.display_name or request.user.username} started following you.',
        )

    return JsonResponse({
        'following': following,
        'follower_count': target.followers.count(),
    })


# ── Notifications ─────────────────────────────────────────────────────────────

def notifications_view(request):
    err = _require_auth(request)
    if err:
        return err

    notifs = request.user.notifications.all()
    return JsonResponse({
        'notifications': [n.to_dict() for n in notifs],
        'unread_count': notifs.filter(read=False).count(),
    })


@csrf_exempt
def notifications_read(request):
    err = _require_auth(request)
    if err:
        return err
    if request.method != 'POST':
        return _method_not_allowed()

    request.user.notifications.filter(read=False).update(read=True)
    return JsonResponse({'ok': True})

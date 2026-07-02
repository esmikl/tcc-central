import json
import re
import urllib.error
import urllib.parse
import urllib.request
from datetime import date
from django.conf import settings
from django.contrib.auth import authenticate
from django.contrib.auth import login as auth_login
from django.contrib.auth import logout as auth_logout
from django.contrib.auth.password_validation import validate_password
from django.core.cache import cache
from django.core.exceptions import ValidationError
from django.core.validators import validate_email
from django.http import JsonResponse
from django.shortcuts import render, get_object_or_404, redirect
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_GET

from .models import (
    User, Board, Post, PostLike, Reply,
    ChatMessage, DirectMessage, Reel, Notification, Follow, Quote,
)


# ── Helpers ───────────────────────────────────────────────────────────────────

def _json_body(request):
    try:
        return json.loads(request.body), None
    except (json.JSONDecodeError, UnicodeDecodeError):
        return None, JsonResponse({'error': 'Invalid JSON'}, status=400)


def _require_auth(request):
    # Django's ModelBackend refuses to resolve a session to an inactive user,
    # so a banned user's existing session already reads as unauthenticated
    # here — no separate is_active check or session invalidation needed.
    if not request.user.is_authenticated:
        return JsonResponse({'error': 'Authentication required'}, status=401)
    return None


def _require_staff(request):
    err = _require_auth(request)
    if err:
        return err
    if not request.user.is_staff:
        return JsonResponse({'error': 'Admin access required'}, status=403)
    return None


def _method_not_allowed():
    return JsonResponse({'error': 'Method not allowed'}, status=405)


def _get_client_ip(request):
    # Prefer X-Forwarded-For (set by a reverse proxy/load balancer) and fall back
    # to the direct connection. If deploying behind a proxy you don't control,
    # make sure it overwrites rather than appends this header, or it can be spoofed.
    forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
    if forwarded_for:
        return forwarded_for.split(',')[0].strip()
    return request.META.get('REMOTE_ADDR')


MINIMUM_AGE = 18


def _calculate_age(birthdate, today=None):
    today = today or date.today()
    return today.year - birthdate.year - ((today.month, today.day) < (birthdate.month, birthdate.day))


TURNSTILE_VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'


def _verify_turnstile(token, remote_ip):
    # Fails closed: any missing token, network error, or bad response means
    # "not verified" — never silently let a registration through.
    if not token:
        return False
    payload = urllib.parse.urlencode({
        'secret': settings.TURNSTILE_SECRET_KEY,
        'response': token,
        'remoteip': remote_ip or '',
    }).encode()
    req = urllib.request.Request(TURNSTILE_VERIFY_URL, data=payload, method='POST')
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            result = json.loads(resp.read().decode())
    except (urllib.error.URLError, TimeoutError, ValueError):
        return False
    return bool(result.get('success'))


# Login brute-force throttle: N failed attempts for a given username+IP pair
# locks that pair out for a cooldown window. Keyed on both so one attacker
# can't lock out a legitimate user just by guessing their username repeatedly
# from a different IP.
LOGIN_MAX_ATTEMPTS = 5
LOGIN_LOCKOUT_SECONDS = 300


def _login_throttle_key(username, ip):
    return f'login_attempts:{username.lower()}:{ip}'


# ── Frontend entry point ──────────────────────────────────────────────────────

def index(request):
    return render(request, 'core/index.html')


def terms_page(request):
    return render(request, 'core/terms.html')


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
    email = data.get('email', '').strip().lower()
    date_of_birth_raw = data.get('date_of_birth', '').strip()
    agreed_to_terms = data.get('agreed_to_terms', False)
    turnstile_token = data.get('turnstile_token', '')

    if not _verify_turnstile(turnstile_token, _get_client_ip(request)):
        return JsonResponse({'error': 'CAPTCHA verification failed. Please try again.'}, status=400)

    if not username:
        return JsonResponse({'error': 'Username is required'}, status=400)
    if not re.match(r'^[a-zA-Z0-9_]{2,32}$', username):
        return JsonResponse({'error': 'Username must be 2–32 characters (letters, numbers, underscores only)'}, status=400)
    if User.objects.filter(username__iexact=username).exists():
        return JsonResponse({'error': 'Username is already taken'}, status=400)

    if not email:
        return JsonResponse({'error': 'Email address is required'}, status=400)
    try:
        validate_email(email)
    except ValidationError:
        return JsonResponse({'error': 'Email address is invalid'}, status=400)
    if User.objects.filter(email__iexact=email).exists():
        return JsonResponse({'error': 'An account with that email already exists'}, status=400)

    if not date_of_birth_raw:
        return JsonResponse({'error': 'Date of birth is required'}, status=400)
    try:
        date_of_birth = date.fromisoformat(date_of_birth_raw)
    except ValueError:
        return JsonResponse({'error': 'Date of birth is invalid'}, status=400)
    if date_of_birth > date.today():
        return JsonResponse({'error': 'Date of birth is invalid'}, status=400)
    if _calculate_age(date_of_birth) < MINIMUM_AGE:
        return JsonResponse({'error': f'You must be at least {MINIMUM_AGE} years old to create an account'}, status=400)

    if not agreed_to_terms:
        return JsonResponse({'error': 'You must agree to the Terms and Conditions'}, status=400)

    try:
        validate_password(password, user=User(username=username, display_name=display_name))
    except ValidationError as e:
        return JsonResponse({'error': ' '.join(e.messages)}, status=400)

    ip = _get_client_ip(request)
    # date_of_birth is validated above (age gate) but intentionally not persisted —
    # we only need to confirm the user is 18+, not retain their birthdate.
    user = User.objects.create_user(
        username=username,
        password=password,
        email=email,
        display_name=display_name or username,
        agreed_to_terms=True,
        terms_accepted_at=timezone.now(),
        registration_ip=ip,
        last_login_ip=ip,
    )
    auth_login(request, user)
    return JsonResponse({'user': user.to_dict(include_private=True)}, status=201)


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

    ip = _get_client_ip(request)
    throttle_key = _login_throttle_key(username, ip)
    if cache.get(throttle_key, 0) >= LOGIN_MAX_ATTEMPTS:
        return JsonResponse(
            {'error': 'Too many failed login attempts. Try again in a few minutes.'},
            status=429,
        )

    user = authenticate(request, username=username, password=password)
    if user is None:
        cache.set(throttle_key, cache.get(throttle_key, 0) + 1, LOGIN_LOCKOUT_SECONDS)
        return JsonResponse({'error': 'Invalid username or password'}, status=401)

    cache.delete(throttle_key)
    user.last_login_ip = ip
    user.save(update_fields=['last_login_ip'])
    auth_login(request, user)
    return JsonResponse({'user': user.to_dict(include_private=True)})


@csrf_exempt
def logout_view(request):
    if request.method != 'POST':
        return _method_not_allowed()
    auth_logout(request)
    return JsonResponse({'ok': True})


def me_view(request):
    if not request.user.is_authenticated:
        return JsonResponse({'error': 'Not authenticated'}, status=401)
    return JsonResponse({'user': request.user.to_dict(include_private=True)})


# ── Profile ───────────────────────────────────────────────────────────────────

@csrf_exempt
def profile_view(request):
    err = _require_auth(request)
    if err:
        return err

    if request.method == 'GET':
        return JsonResponse({'user': request.user.to_dict(include_private=True)})

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
        if 'cookie_consent_analytics' in data:
            user.cookie_consent_analytics = bool(data['cookie_consent_analytics'])
            user.cookie_consent_at = timezone.now()
        user.save()
        return JsonResponse({'user': user.to_dict(include_private=True)})

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

    try:
        validate_password(new_pw, user=request.user)
    except ValidationError as e:
        return JsonResponse({'error': ' '.join(e.messages)}, status=400)

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
def board_detail(request, board_id):
    board = get_object_or_404(Board, pk=board_id)

    if request.method == 'PUT':
        err = _require_staff(request)
        if err:
            return err
        data, err = _json_body(request)
        if err:
            return err

        name = data.get('name', '').strip()
        if not name:
            return JsonResponse({'error': 'Board name is required'}, status=400)
        if Board.objects.filter(name__iexact=name).exclude(pk=board.pk).exists():
            return JsonResponse({'error': 'A board with that name already exists'}, status=400)

        board.name = name
        if 'color' in data:
            board.color = data['color']
        board.save()
        return JsonResponse({'board': {'id': board.id, 'name': board.name, 'color': board.color}})

    if request.method == 'DELETE':
        err = _require_staff(request)
        if err:
            return err
        board.delete()
        return JsonResponse({'ok': True})

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

        post = Post.objects.create(board=board, user=request.user, text=text, ip_address=_get_client_ip(request))
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

        reply = Reply.objects.create(post=post, user=request.user, text=text, ip_address=_get_client_ip(request))

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

        msg = ChatMessage.objects.create(channel=channel, user=request.user, text=text, ip_address=_get_client_ip(request))
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

        msg = DirectMessage.objects.create(sender=request.user, recipient=other, text=text, ip_address=_get_client_ip(request))
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

        reel = Reel(user=request.user, caption=caption, emoji=emoji, bg=bg, sound=sound, ip_address=_get_client_ip(request))

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


# ── Admin Dashboard ─────────────────────────────────────────────────────────

def admin_dashboard_page(request):
    if not request.user.is_authenticated or not request.user.is_staff:
        return redirect('index')
    return render(request, 'core/admin_dashboard.html')


@require_GET
def admin_users(request):
    err = _require_staff(request)
    if err:
        return err

    users = User.objects.all().order_by('-date_joined')
    return JsonResponse({
        'users': [
            {
                'id': u.id,
                'username': u.username,
                'display_name': u.display_name or u.username,
                'email': u.email,
                'is_staff': u.is_staff,
                'is_banned': not u.is_active,
                'date_joined': u.date_joined.isoformat(),
                'post_count': u.posts.count(),
                'last_login_ip': u.last_login_ip,
            }
            for u in users
        ]
    })


@csrf_exempt
def admin_ban_user(request, username):
    err = _require_staff(request)
    if err:
        return err
    if request.method != 'POST':
        return _method_not_allowed()

    target = get_object_or_404(User, username__iexact=username)
    if target == request.user:
        return JsonResponse({'error': "You can't ban your own account"}, status=400)

    target.is_active = not target.is_active
    target.save(update_fields=['is_active'])
    return JsonResponse({'username': target.username, 'is_banned': not target.is_active})


@csrf_exempt
def admin_toggle_staff(request, username):
    err = _require_staff(request)
    if err:
        return err
    if request.method != 'POST':
        return _method_not_allowed()

    target = get_object_or_404(User, username__iexact=username)
    if target == request.user:
        return JsonResponse({'error': "You can't change your own admin status"}, status=400)

    if target.is_staff and User.objects.filter(is_staff=True).exclude(pk=target.pk).count() == 0:
        return JsonResponse({'error': 'At least one admin must remain'}, status=400)

    target.is_staff = not target.is_staff
    target.save(update_fields=['is_staff'])
    return JsonResponse({'username': target.username, 'is_staff': target.is_staff})


@require_GET
def admin_posts(request):
    err = _require_staff(request)
    if err:
        return err

    posts = Post.objects.select_related('user', 'board').order_by('-created_at')
    query = request.GET.get('q', '').strip()
    if query:
        from django.db.models import Q
        posts = posts.filter(Q(text__icontains=query) | Q(user__username__icontains=query))

    posts = posts[:200]
    return JsonResponse({
        'posts': [
            {
                'id': p.id,
                'board': p.board.name,
                'board_id': p.board_id,
                'user': p.user.display_name or p.user.username,
                'username': p.user.username,
                'text': p.text,
                'time': p.created_at.strftime('%-m/%-d/%y'),
            }
            for p in posts
        ]
    })


@require_GET
def quotes_list(request):
    return JsonResponse({'quotes': [q.text for q in Quote.objects.all()]})


@csrf_exempt
def admin_quotes(request):
    if request.method == 'GET':
        err = _require_staff(request)
        if err:
            return err
        quotes = Quote.objects.all()
        return JsonResponse({'quotes': [{'id': q.id, 'text': q.text, 'order': q.order} for q in quotes]})

    if request.method == 'POST':
        err = _require_staff(request)
        if err:
            return err
        data, err = _json_body(request)
        if err:
            return err

        text = data.get('text', '').strip()
        if not text:
            return JsonResponse({'error': 'Quote text is required'}, status=400)

        quote = Quote.objects.create(text=text, order=Quote.objects.count())
        return JsonResponse({'quote': {'id': quote.id, 'text': quote.text, 'order': quote.order}}, status=201)

    return _method_not_allowed()


@csrf_exempt
def admin_quote_detail(request, quote_id):
    err = _require_staff(request)
    if err:
        return err

    quote = get_object_or_404(Quote, pk=quote_id)

    if request.method == 'PUT':
        data, err = _json_body(request)
        if err:
            return err

        text = data.get('text', '').strip()
        if not text:
            return JsonResponse({'error': 'Quote text is required'}, status=400)

        quote.text = text
        if 'order' in data:
            quote.order = data['order']
        quote.save()
        return JsonResponse({'quote': {'id': quote.id, 'text': quote.text, 'order': quote.order}})

    if request.method == 'DELETE':
        quote.delete()
        return JsonResponse({'ok': True})

    return _method_not_allowed()

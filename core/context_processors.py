from django.conf import settings


def analytics(request):
    return {
        # Only render the tracking snippet outside of local/dev runs, so
        # testing and development don't pollute real Google Analytics data.
        'ga_measurement_id': settings.GA_MEASUREMENT_ID if not settings.DEBUG else '',
    }


def turnstile(request):
    # Unlike analytics, the CAPTCHA renders in every environment (including
    # dev) so the signup flow can actually be tested end to end.
    return {
        'turnstile_site_key': settings.TURNSTILE_SITE_KEY,
    }

from django.db import migrations

# Moves the rotating header quotes out of static/script.js and into the
# database so admins can manage them from the admin dashboard.
QUOTES = [
    '"Ill blow you up, and itll be cool!"',
    '"Natural Selection, fucker should be shot!"',
    '"My Wrath from Januarys incident will be god-like, not to mention our revenge in the commons!"',
    '"Youve given us shit for years, youre fucking gonna pay for all the shit! We dont give a shit, cause were gonna die doing it!"',
    '"Stick to the plan, you drive I cover! Kill the cops!"',
    '“Imagine a society that subjects people to conditions that make them terribly unhappy then gives them the drugs to take away their unhappiness,"',
    '"Our society tends to regard as a sickness any mode of thought or behavior that is inconvenient for the system,"',
    '"The conservatives are fools: They whine about the decay of traditional values, yet they enthusiastically support technological progress,"',
    '"Inside every cynic is a disappointed idealist,"',
    '"I incessantly have nothing other than scorn for humanity,"',
]


def seed_quotes(apps, schema_editor):
    Quote = apps.get_model('core', 'Quote')
    for i, text in enumerate(QUOTES):
        Quote.objects.get_or_create(text=text, defaults={'order': i})


def remove_seeded_quotes(apps, schema_editor):
    Quote = apps.get_model('core', 'Quote')
    Quote.objects.filter(text__in=QUOTES).delete()


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0006_quote'),
    ]

    operations = [
        migrations.RunPython(seed_quotes, remove_seeded_quotes),
    ]

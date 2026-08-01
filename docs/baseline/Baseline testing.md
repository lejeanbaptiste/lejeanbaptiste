# Set-up

Thinkpad 2018
i5-8350U 1.70GHz, 16 GB RAM
Win 11

# Version

v0.0.4-rc.7, Alpha

## File

NanQiShu_bio_013_j_22_YuZhangWenXianWangYi_clean.xml (34k)


# Cold launch

Situation: file in open tab

CPU: 0-24% (brief peak), ditto,  26.7% peak
RAM: 600 MB -> 1 GB, ditto, ditto 
Time: 22s, 21s, 30s

# Open large XML

CPU: 2%-15%, 1%-28% (brief peak), 1%-66% (brief peak), 
RAM: 700 mo -> 800 mo (cold, tabs closed on start up), 700 mo -> 1 GB (cold, tabs closed on start up), 2Go -> 2.8 (brief peak), 2.2 Go unchanged
Time: 18s, 8s, 8s

No... after a while we top out at 0.8-1 GB of ram...
#  Display tree

Switching tree -> database viewer -> collapse -> open

CPU: 15% max, no change
RAM: 850 Mo max, no change
Time: VERY SLOW - 20s

### Virtualised tag bomb candidates, monaco persist, tree flattening

Impression: it looks worse, and more choppy, less reactive, but I may be imagining it.

# Switch visual - source

visual - source - visual

CPU: 5%-20% (brief peak), same every time 
RAM: 0.8-1.2 GB, same every time
Time: 17s, 13s, 11s
### Virtualised tag bomb candidates, monaco persist, tree flattening

This feels a lot faster. I just wish we could go from source back to visual this quickly...
# Manual tagging

CPU: no impact
RAM: no impact
Time: n/a; laggy (on a laggy machine)


# Date tagging

CPU:
RAM:
Time:

# Tag bomb
(see outputs)
CPU: 1-20%
RAM: 2GB-4.15GB (briefly)
Time: (see outputs)
# Database lookup

see output

# Update database entry

Can't type chinese, so no real use, but see output

# Lookup function

no problem, see output

# Disambiguate

no problem, see output

# Disambiguate, open candidate

Quite laggy, item froze once
# Bugs

Races -> blank screen: II
forced to kill process to close: IIII
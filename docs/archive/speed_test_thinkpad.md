# Unrelated

CRUCIAL: the style name finder placed the character 字 in the wrong place, AFTER the name. The \1 and \2 capture groups appear to be reversed.
I'm still getting tag bomb results that are in the TEI header or somewhere that is not visible, including latin characters...
XML tree viewer was broken, stale tree race -- confirm the fix works.
The snackbar notifications do not reflect our updated ribbon and rank system.
We need to filter out all placeNames from all authority packs where the placename consists only of Chinese numbers. Same for <title> and persname for that matter.
From here on out, where roleName is just a string in local matching a string in the Norbert pack, auto-associate.

# Speed test

This computer is laggy, so 'laggy' is probably normal behaviour below without further qualification.

Opened Grognard, document loads; CPU peaks around 26%; RAM 1700. Once loaded these drop down to an average of 1% CPU or less, about 1 Go of RAM. The CPU is however doing things, bouncing between about 0.8% and 10% while doing absolutely nothing.

Maybe 10 tabs were open. I closed all but one. There was a minute long spike of activity, but now the CPU and RAM are about identical to the situation with 10 tabs open.

Poking around in some panels, navigating the text, doing very light things, memory would go up to just below 2 Go, cpu max at 20%.

Editing the one-line description in entities viewer pop-up is painfully slow and has the cpu working at 26% constantly. It takes several seconds to delete one character.

Adding a nationality was faster, but CPU peaked at 40% while writing to database.

Navigating the XML tree is slow, as expected, CPU and 26-30% constantly. Process is choppy.

Find and replace is SNAPPY, never goes above 5% CPU.

Keyboard navigating the editor and adding tags is sluggish

Opening the disambiguation panel makes memory usage jump to 3 Go. CPU remained unchanged with caching.

Sanmiao's progress bar makes it feel completely laggy and non responsive. However, cpu use and ram were very reasonable. Instead of showing the user blocks and a progress bar, we should maybe adopt a different visual strategy.

The auto-tag pannel is VERY LAGGY as it is calculating totals. I think that we should add a settings panel option to turn this function, and the default should be 'off'

A giant tag bomb briefly peaks at 30% cpu, otherwise staying below 20%. That surprises me, because, once again, the progress bar choppiness makes it feel unresponsive. We should rethink this.

Likewise, applying tags LOOKS SLOW.

Maybe because of virtualisation, after going between the validate/disambiguate panels and the editor, the panels stop tracking editor contents after a while, so no more highlighting, no more skipping. That is a big inconvenience. We should at least be able to 'reindex' or something when refreshed.

Refresh validate results freezes the screen for several seconds while processing.

The disambiguation panel is actually surprisingly snappy when not in dev. The compiled pr

- Editor keyboard input and XML-tree navigation.
- Disambiguation memory growth.
- Auto-tagging totals/progress rendering.
- Validation refresh and tag application.
- Background CPU while idle

# Reference implementation

The sports and profile layout follows the user's original recordings dated 2026-09-07. The UI is rendered by this application; the reference website is not embedded or covered by replacement controls.

- `ScreenRecording_09-07-2026 14-12-36_1.mp4`: wordmark, game and sport graphics extracted from frames at 14 and 19.5 seconds. The snooker and volleyball graphics come from the user's supplied screenshots.
- `IMG_5129.MP4`: profile spacing, typography, balance panel, inset separators, and header/navigation dimensions. The profile displays this application's account data.
- Public brand204 theme: Roboto, header `#171716`, background `#f5f4f1`, primary `#f2f740`, deposit `#009e69`, odds `#2f8fc7`. The semibold font is served locally from the original public font asset; regular Roboto comes from Google Fonts.
- Header: 56px. Mobile bottom navigation: 54px plus device safe area. Sport graphics: 32px. Tournament discs: 56px. Tournament heading: 32px. Team names: 14px. Odds: 16px in 48px controls.

The wordmark and reference artwork reproduce the supplied visual design. Login is for the local Arena Line account, and the application keeps that distinction in the account form. Match names and prices are still supplied by the live feed; none of the matches in the recordings are seeded as current events.
# September 9 match detail and bet history update

Sharing reference: `ScreenRecording_09-09-2026 17-03-36_1.mp4`. Share opens a
full-height warm-gray surface with an X, bottom-aligned perforated gray ticket,
amount visibility switch and circular save/share controls. The ticket is drawn
once to canvas for both the screen and PNG export. Accepted bets offer image
sharing and saving; calculated bets offer saving, as in the reference. Amount
visibility applies to both stake and payout in the rendered/exported image.

Reference: user video `IMG_5137.MP4`. The bottom bar's third item is «Мої ставки».
Accepted and settled records use the reference's full-width white rows, gray
selection summary, result marker, per-period score columns, payout rows and small
rounded repeat/share controls. Match details use their own white header, segmented
overview / H2H / odds tabs, centered score or start time, recent form, horizontal
map filters and grouped white markets. All values come from the user's account,
the live feed, or the provider's public result archive. No reference account
balance, bet number, score or example team is inserted as application data.

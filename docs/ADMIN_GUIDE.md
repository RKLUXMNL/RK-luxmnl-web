# RK Luxmnl — Ms. Kyla's administrator guide

## Sign in

Open `/admin/login` on the business domain and use your provisioned account. Sign out on shared devices. Your developer can reset access with the administrator setup command; there is no public account registration or emailed password-reset flow.

## Add and publish jewelry

1. Open **Products → Add product**.
2. Enter the real product name, category, description, availability and placement. `Showroom` is the default; `Live selling` products appear on the live selling page and in showroom search results. Leave price blank for **Price Upon Inquiry**. A numeric price, including zero, is published as entered; verify it carefully. Enter an **Original price** only when it is higher than the current price and should be struck through. Products in the normal `Sale` category get an `ON SALE` badge even without an original price.
3. In **Media → Add photos and videos**, select multiple JPEG/PNG/WebP photos and MP4/WebM clips together. You can add another selection before uploading. Click **Upload N files** and watch each file's progress. Successful files are retained if another fails; use **Retry file** for failures. Finish or remove queued files before saving. Products support up to 30 combined gallery items.
4. Use the media arrows to arrange photos and videos in the desired playback order. **Set primary image** moves a selected photograph to the front. Remove detaches it from this piece without deleting it from storage. Failed-file retries preserve the original selection order.
5. For a short product clip, use the ordinary upload. For a larger video, expand **Upload a video using Stream** and wait until it is ready before attaching/saving it.
6. Fill only specifications that are known. Empty fields are hidden publicly. Add an authenticity statement or certificate details only when approved for that specific piece. Certificate documents can be images or PDFs.
7. Leave product-specific policy fields blank to inherit approved Website Settings. Enter a product-specific override only when it is genuinely different and approved.
8. Confirm the inventory/media/details checkbox. Check **Publish on the website**, then **Save product**. Publication requires a ready photograph and owner-confirmed information.
9. Open `/showroom`, find the item, and check its gallery, specifications, price and inquiry form. Live selling placements are verified on `/live-selling`. All cards open `/products/[slug]`.

### Customer gallery playback

Product pages use one ordered photo/video gallery. Photos advance every five seconds; a video starts muted and advances only when it finishes. The sequence loops back to the first item. Customers can enable sound using the player controls, pause/resume the slideshow, select a thumbnail, navigate with arrows or swipe photos on mobile.

Automatic playback pauses when the gallery is off-screen, the browser tab is hidden, an inquiry dialog is open, or the fullscreen inspection viewer is open. Reduced-motion preferences disable automatic cycling by default; customers can explicitly start it. Fullscreen inspection retains manual controls and image zoom. Browser autoplay restrictions can require pressing Play; they are never bypassed.

Cloudflare-hosted product videos use the official Stream player API for playback and completion events. This still requires the real Stream account configuration and acceptance testing described in the deployment guide.

Uncheck Publish to remove a listing temporarily. Archive removes it from the public catalog while preserving customer inquiry history. Editing an archived record can restore it as an active record; verify its publication checkbox when saving. Changes automatically apply to linked live-session and Reel product cards.

### Find and print products

Use the search bar above the Products table to find any catalog product by name, slug, description, category, availability, placement, price, original price, specification, policy or certificate detail. Press **Search** to apply it and **Clear** to see all products again. Use the arrows on the **Sort by** control to change the order.

Tick one or more products in the leftmost column, then click **Print selected**. A protected print page opens with the selected items' image, name, price, description, specifications, policies and approved authenticity/certificate details. Use the browser print dialog to print or save as PDF. Selection is temporary and does not change the products.

## Categories

Use **Categories** to add or rename a category. A category containing products cannot be deleted until those products are reassigned. The six initial categories are editable; no product is duplicated to appear in a different media listing.

## Customer inquiries

Use **Inquiries** to search a customer name, email or message. Expand a request to see contact details, the selected product and questions. Set **New → Contacted → Closed** as appropriate. Contact links open your email/phone tools. No Instagram/Facebook DM is automatically sent by the website.

The overview displays real database counts. The dashboard receives requests from every browser, unlike the former presentation website. Use **Load more records** for older records.

## Viewing appointments

1. Open **Viewings → Availability**.
2. Add an available date/time and capacity. All displayed times use **Asia/Manila**.
3. Edit time/capacity, disable slots, or block a date as needed. Contact existing customers before changing their requested time or blocking a date they requested.
4. New customer requests are **Pending**. Pending and Confirmed requests occupy capacity to prevent duplicate reservations. Cancel abandoned requests to release their slots.
5. After speaking with the customer, mark **Confirmed**, **Completed** or **Cancelled**. A request is never automatically confirmed.

## Custom jewelry requests

Open **Customization**, expand a request and review preferences, budget, design description and contact details. Reference images are private and open only for authenticated administrators through fresh authorized links. Update the status as work progresses. Never post private reference URLs publicly.

## Live selling calendar and four-hour recordings

1. Open **Live Selling → Add session**.
2. Enter the title, Philippine date/time and description. Add the approved **Instagram Live URL**, the **Facebook Live URL**, or both. Leave the other URL blank when broadcasting on only one platform.
3. Choose **Scheduled**, select any associated catalog products, and publish when the event information is ready.
4. When broadcasting, edit it to **Live Now**. Customers see **Watch Live on Instagram**, **Watch Live on Facebook**, or both, depending on the links you saved. The website does not pretend that either platform's live video is always embeddable.
5. After the event, change the status to **Completed**. A session can remain published without a recording and will show **Replay not available yet**.
6. To add the replay, choose the original supported MP4/WebM file and **Upload selected file** in the session editor. The progress bar uploads directly to Cloudflare Stream, not the website server.
7. Use Pause/Resume for interruptions. After a page reload, reselect the identical file in the same browser tab to recover an unexpired upload. If authorization expired or a processing failure is permanent, start a new upload authorization and reselect the replacement.
8. Keep the page open until upload completes. Processing may continue afterward. The file must become **ready** before publishing it as a playable replay. **Media Library → Check processing** can refresh status.
9. Select the ready replay, associate the products featured in that event and save. Optional timestamps are entered in **seconds**; for example 01:35:20 is 5720 seconds.
10. Preview the public date and replay before advertising it. Featured items below the recording use the same catalog records as the shop.

Four-hour recordings need sufficient Cloudflare storage capacity and a file within the account's upload-size limits. Duration alone does not determine file size. Your developer must activate and verify the provider account before the first long recording. Keep your own original-file backup; Stream's encoded playback is not an exact archival copy of the uploaded original.

## Instagram Reels

1. Open **Reels → Add Reel**.
2. Enter a title and description. Add an actual Instagram Reel URL for an external link, an original video upload for on-site playback, or both.
3. Associate the catalog products shown.
4. To offer downloads, upload the original file and explicitly confirm ownership/authorization in the upload control. Then enable **Allow downloading the authorized original file**.
5. Publish after the uploaded video is ready. URL-only Instagram posts cannot enable downloads. No Instagram scraping or download bypass is implemented.

Disable downloads to prevent new download links. Already issued short-lived file links expire within five minutes. Unpublishing the Reel removes public access to new links and playback authorization.

## Media library

See uploaded files and processing states, preview ready recordings, check Stream processing and delete unused files. To replace media, upload the new file, select it in the corresponding product/session/Reel, save, then delete the detached old file. Referenced files and the current business logo cannot be deleted until detached. Deletion removes stored originals and generated image variants permanently.

## Website settings and policies

Keep the business name, public contact details, actual Instagram/Facebook URLs, viewing location, meetup information and business logo current. Upload the approved logo or enter its HTTPS URL. Save the settings after uploading. The header and footer display sizes are fixed in the site design; replacing the logo file should not require resizing it in settings.

Enter only approved payment, return/exchange and installment/layaway text. Leave an unavailable policy blank to hide its section. Clearing installment text disables the informational installment section; no financing or payment processing occurs on the website. Product-specific approved text takes precedence over shared defaults.

## When something fails

- Missing storage/Stream configuration: ask the developer to connect the provider; no upload is falsely marked successful.
- Upload interrupted: retry/resume, or start a fresh authorization after expiry.
- Processing failed: check provider status and use a valid replacement file.
- Product cannot publish: check the inventory confirmation, ready image, category and other validation messages.
- Appointment unavailable: another active request may occupy capacity; choose a different time or update availability after speaking with the customer.
- No email/SMS arrives: the dashboard is the implemented reception workflow; automated notifications require a separate delivery integration.

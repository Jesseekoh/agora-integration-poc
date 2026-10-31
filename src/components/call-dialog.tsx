import { MicIcon, MicOffIcon, PhoneIcon, PhoneOffIcon, VideoIcon, VideoOffIcon } from './icons';

// Markup for every call state (ringing, calling, in call). It's inert on its own:
// src/client/calls.ts fills it in, toggles the [hidden] parts and opens the dialog.
export const CallDialog = () => (
  <>
    <dialog id="call-dialog" class="modal modal-bottom sm:modal-middle">
      <div class="modal-box flex max-w-2xl flex-col items-center gap-5 p-6">
        <div class="flex flex-col items-center gap-3 text-center" data-call-header>
          <div class="avatar avatar-placeholder">
            <div class="w-20 rounded-full bg-primary/10 text-primary">
              <span class="text-2xl font-medium" data-call-initials />
            </div>
          </div>
          <div>
            <div class="text-xl font-semibold" data-call-name />
            <div class="text-sm text-base-content/60" data-call-status />
          </div>
        </div>

        {/* Video calls only. Remote tiles are added per participant. */}
        <div class="relative w-full" data-call-stage hidden>
          <div class="grid min-h-64 w-full gap-2 overflow-hidden rounded-box bg-neutral" data-call-remote />
          <div
            class="absolute right-3 bottom-3 aspect-video w-1/4 min-w-24 overflow-hidden rounded-box border-2 border-base-100 bg-neutral shadow-lg"
            data-call-local
          />
        </div>

        <div class="flex items-center gap-4">
          <button type="button" class="btn btn-circle btn-lg" data-call-action="mic" hidden aria-label="Mute microphone">
            <span data-on><MicIcon class="size-5" /></span>
            <span data-off hidden><MicOffIcon class="size-5" /></span>
          </button>
          <button type="button" class="btn btn-circle btn-lg" data-call-action="cam" hidden aria-label="Turn off camera">
            <span data-on><VideoIcon class="size-5" /></span>
            <span data-off hidden><VideoOffIcon class="size-5" /></span>
          </button>
          <button type="button" class="btn btn-circle btn-lg btn-error" data-call-action="decline" hidden aria-label="Decline">
            <PhoneOffIcon class="size-5" />
          </button>
          <button type="button" class="btn btn-circle btn-lg btn-success" data-call-action="accept" hidden aria-label="Accept">
            <PhoneIcon class="size-5" />
          </button>
          <button type="button" class="btn btn-circle btn-lg btn-error" data-call-action="hangup" hidden aria-label="Hang up">
            <PhoneOffIcon class="size-5" />
          </button>
        </div>
      </div>
    </dialog>

    <div class="toast toast-center toast-top z-50" data-call-toasts />
  </>
);

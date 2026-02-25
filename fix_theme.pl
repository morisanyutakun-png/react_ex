#!/usr/bin/env perl
use strict;
use warnings;

# Process each file passed as argument
local $^I = '';  # in-place editing
while (<>) {
    # === hover: prefixed variants FIRST ===
    s/hover:bg-neutral-800\/50/hover:bg-black\/[0.04]/g;
    s/hover:bg-neutral-800\/70/hover:bg-black\/[0.04]/g;
    s/hover:bg-neutral-800(?!\/)/hover:bg-black\/[0.04]/g;
    s/hover:bg-rose-950\/30/hover:bg-rose-50/g;
    s/hover:border-neutral-700/hover:border-black\/[0.12]/g;
    s/hover:border-neutral-600/hover:border-black\/[0.12]/g;
    s/hover:text-neutral-200/hover:text-\[#1d1d1f\]/g;
    s/hover:text-neutral-400/hover:text-\[#6e6e73\]/g;
    s/hover:text-rose-500/hover:text-rose-600/g;

    # === placeholder: prefixed variant ===
    s/placeholder:text-neutral-600/placeholder:text-\[#aeaeb2\]/g;

    # === focus: compound pattern ===
    s/focus:border-red-600 focus:ring-2 focus:ring-red-600\/40/focus:border-red-500 focus:ring-4 focus:ring-red-600\/10/g;

    # === bg-neutral (specific /50 before bare) ===
    s/bg-neutral-800\/50/bg-\[#f5f5f7\]/g;
    s/bg-neutral-800(?![\w\/])/bg-\[#f5f5f7\]/g;
    s/bg-neutral-900(?![\w\/])/bg-white/g;

    # === border-neutral ===
    s/border-neutral-800/border-black\/[0.06]/g;
    s/border-neutral-700/border-black\/[0.08]/g;

    # === text-neutral (longest number to shortest) ===
    s/text-neutral-700/text-\[#d2d2d7\]/g;
    s/text-neutral-600/text-\[#d2d2d7\]/g;
    s/text-neutral-500/text-\[#aeaeb2\]/g;
    s/text-neutral-400/text-\[#6e6e73\]/g;
    s/text-neutral-300/text-\[#424245\]/g;
    s/text-neutral-200/text-\[#1d1d1f\]/g;
    s/text-neutral-100/text-\[#1d1d1f\]/g;
    s/text-neutral-50(?!\d)/text-\[#1d1d1f\]/g;

    # === colored backgrounds ===
    s/bg-red-950\/30/bg-red-50/g;
    s/bg-emerald-950\/30/bg-emerald-50/g;
    s/bg-amber-950\/30/bg-amber-50/g;
    s/bg-violet-950\/30/bg-violet-50/g;
    s/bg-rose-950\/30/bg-rose-50/g;

    # === colored text ===
    s/text-red-500/text-red-600/g;
    s/text-red-400/text-red-600/g;
    s/text-emerald-400/text-emerald-600/g;
    s/text-emerald-500/text-emerald-600/g;
    s/text-amber-400/text-amber-600/g;
    s/text-amber-500/text-amber-600/g;
    s/text-violet-400/text-violet-600/g;
    s/text-rose-400/text-rose-600/g;

    # === colored borders ===
    s/border-red-900\/50/border-red-200/g;
    s/border-emerald-900\/50/border-emerald-200/g;

    # === shadow-glow-sm removal ===
    s/ shadow-glow-sm//g;
    s/shadow-glow-sm //g;

    print;
}

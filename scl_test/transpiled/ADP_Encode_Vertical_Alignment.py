import math

def ADP_Encode_Vertical_Alignment(context, global_dbs):
    # Return Type: String
    # VAR_INPUT:
    #   vertical_alignment: String
    #   decoded: ADP: Decoded: Vertical Alignment
    #   encoded: ADP: Encoded: Formatting: Vertical Alignment
    # VAR_TEMP:
    #   _return: String
    if (context['vertical_alignment'] == context['decoded'].bottom_hold):
        context['_return'] = context['encoded'].bottom_hold
        # GOTO RTRN (Not supported)
    if (context['vertical_alignment'] == context['decoded'].fill_hold):
        context['_return'] = context['encoded'].fill_hold
        # GOTO RTRN (Not supported)
    if (context['vertical_alignment'] == context['decoded'].middle_hold):
        context['_return'] = context['encoded'].middle_hold
        # GOTO RTRN (Not supported)
    if (context['vertical_alignment'] == context['decoded'].top_hold):
        context['_return'] = context['encoded'].top_hold
        # GOTO RTRN (Not supported)
    if (context['vertical_alignment'] == context['decoded'].bottom_scroll):
        context['_return'] = context['encoded'].bottom_scroll
        # GOTO RTRN (Not supported)
    if (context['vertical_alignment'] == context['decoded'].fill_scroll):
        context['_return'] = context['encoded'].fill_scroll
        # GOTO RTRN (Not supported)
    if (context['vertical_alignment'] == context['decoded'].middle_scroll):
        context['_return'] = context['encoded'].middle_scroll
        # GOTO RTRN (Not supported)
    if (context['vertical_alignment'] == context['decoded'].top_scroll):
        context['_return'] = context['encoded'].top_scroll
        # GOTO RTRN (Not supported)
    # LABEL RTRN
    context['ADP: Encode: Vertical Alignment'] = context['_return']

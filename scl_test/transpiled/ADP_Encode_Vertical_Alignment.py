import math

def ADP_Encode_Vertical_Alignment(context=None, global_dbs=None, **kwargs):
    if context is None: context = {}
    if global_dbs is None: global_dbs = {}
    for k, v in kwargs.items():
        context[k] = v
    # Return Type: String
    # VAR_INPUT:
    #   vertical_alignment: String
    #   decoded: ADP: Decoded: Vertical Alignment
    #   encoded: ADP: Encoded: Formatting: Vertical Alignment
    # VAR_TEMP:
    #   _return: String
    if (context['vertical_alignment'] == context['decoded'].bottom_hold):
        context['_return'] = context['encoded'].bottom_hold
        pass # GOTO RTRN (Not supported)
    if (context['vertical_alignment'] == context['decoded'].fill_hold):
        context['_return'] = context['encoded'].fill_hold
        pass # GOTO RTRN (Not supported)
    if (context['vertical_alignment'] == context['decoded'].middle_hold):
        context['_return'] = context['encoded'].middle_hold
        pass # GOTO RTRN (Not supported)
    if (context['vertical_alignment'] == context['decoded'].top_hold):
        context['_return'] = context['encoded'].top_hold
        pass # GOTO RTRN (Not supported)
    if (context['vertical_alignment'] == context['decoded'].bottom_scroll):
        context['_return'] = context['encoded'].bottom_scroll
        pass # GOTO RTRN (Not supported)
    if (context['vertical_alignment'] == context['decoded'].fill_scroll):
        context['_return'] = context['encoded'].fill_scroll
        pass # GOTO RTRN (Not supported)
    if (context['vertical_alignment'] == context['decoded'].middle_scroll):
        context['_return'] = context['encoded'].middle_scroll
        pass # GOTO RTRN (Not supported)
    if (context['vertical_alignment'] == context['decoded'].top_scroll):
        context['_return'] = context['encoded'].top_scroll
        pass # GOTO RTRN (Not supported)
    pass # LABEL RTRN
    context['ADP: Encode: Vertical Alignment'] = context['_return']

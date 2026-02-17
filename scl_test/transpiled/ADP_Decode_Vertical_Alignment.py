import math

def ADP_Decode_Vertical_Alignment(context=None, global_dbs=None, **kwargs):
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
    if (context['vertical_alignment'] == context['encoded'].bottom_hold):
        context['_return'] = context['decoded'].bottom_hold
        pass # GOTO RTRN (Not supported)
    if (context['vertical_alignment'] == context['encoded'].fill_hold):
        context['_return'] = context['decoded'].fill_hold
        pass # GOTO RTRN (Not supported)
    if (context['vertical_alignment'] == context['encoded'].middle_hold):
        context['_return'] = context['decoded'].middle_hold
        pass # GOTO RTRN (Not supported)
    if (context['vertical_alignment'] == context['encoded'].top_hold):
        context['_return'] = context['decoded'].top_hold
        pass # GOTO RTRN (Not supported)
    if (context['vertical_alignment'] == context['encoded'].bottom_scroll):
        context['_return'] = context['decoded'].bottom_scroll
        pass # GOTO RTRN (Not supported)
    if (context['vertical_alignment'] == context['encoded'].fill_scroll):
        context['_return'] = context['decoded'].fill_scroll
        pass # GOTO RTRN (Not supported)
    if (context['vertical_alignment'] == context['encoded'].middle_scroll):
        context['_return'] = context['decoded'].middle_scroll
        pass # GOTO RTRN (Not supported)
    if (context['vertical_alignment'] == context['encoded'].top_scroll):
        context['_return'] = context['decoded'].top_scroll
        pass # GOTO RTRN (Not supported)
    pass # LABEL RTRN
    context['ADP: Decode: Vertical Alignment'] = context['_return']

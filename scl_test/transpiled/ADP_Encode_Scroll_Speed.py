import math

def ADP_Encode_Scroll_Speed(context=None, global_dbs=None, **kwargs):
    if context is None: context = {}
    if global_dbs is None: global_dbs = {}
    for k, v in kwargs.items():
        context[k] = v
    # Return Type: String
    # VAR_INPUT:
    #   scroll_speed: String
    #   decoded: ADP: Decoded: Scroll Speed
    #   encoded: ADP: Encoded: Formatting: Scroll Speed
    # VAR_TEMP:
    #   _return: String
    if (context['scroll_speed'] == context['decoded'].slowest):
        context['_return'] = context['encoded'].slowest
        pass # GOTO RTRN (Not supported)
    if (context['scroll_speed'] == context['decoded'].slow):
        context['_return'] = context['encoded'].slow
        pass # GOTO RTRN (Not supported)
    if (context['scroll_speed'] == context['decoded'].normal):
        context['_return'] = context['encoded'].normal
        pass # GOTO RTRN (Not supported)
    if (context['scroll_speed'] == context['decoded'].fast):
        context['_return'] = context['encoded'].fast
        pass # GOTO RTRN (Not supported)
    if (context['scroll_speed'] == context['decoded'].fastest):
        context['_return'] = context['encoded'].fastest
        pass # GOTO RTRN (Not supported)
    pass # LABEL RTRN
    context['ADP: Encode: Scroll Speed'] = context['_return']

import math

def ADP_Decode_Scroll_Speed(context=None, global_dbs=None, **kwargs):
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
    if (context['scroll_speed'] == context['encoded'].slowest):
        context['_return'] = context['decoded'].slowest
        pass # GOTO RTRN (Not supported)
    if (context['scroll_speed'] == context['encoded'].slow):
        context['_return'] = context['decoded'].slow
        pass # GOTO RTRN (Not supported)
    if (context['scroll_speed'] == context['encoded'].normal):
        context['_return'] = context['decoded'].normal
        pass # GOTO RTRN (Not supported)
    if (context['scroll_speed'] == context['encoded'].fast):
        context['_return'] = context['decoded'].fast
        pass # GOTO RTRN (Not supported)
    if (context['scroll_speed'] == context['encoded'].fastest):
        context['_return'] = context['decoded'].fastest
        pass # GOTO RTRN (Not supported)
    pass # LABEL RTRN
    context['ADP: Decode: Scroll Speed'] = context['_return']

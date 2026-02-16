import math

def ADP_Decode_Scroll_Speed(context, global_dbs):
    # Return Type: String
    # VAR_INPUT:
    #   scroll_speed: String
    #   decoded: ADP: Decoded: Scroll Speed
    #   encoded: ADP: Encoded: Formatting: Scroll Speed
    # VAR_TEMP:
    #   _return: String
    if (context['scroll_speed'] == context['encoded'].slowest):
        context['_return'] = context['decoded'].slowest
        # GOTO RTRN (Not supported)
    if (context['scroll_speed'] == context['encoded'].slow):
        context['_return'] = context['decoded'].slow
        # GOTO RTRN (Not supported)
    if (context['scroll_speed'] == context['encoded'].normal):
        context['_return'] = context['decoded'].normal
        # GOTO RTRN (Not supported)
    if (context['scroll_speed'] == context['encoded'].fast):
        context['_return'] = context['decoded'].fast
        # GOTO RTRN (Not supported)
    if (context['scroll_speed'] == context['encoded'].fastest):
        context['_return'] = context['decoded'].fastest
        # GOTO RTRN (Not supported)
    # LABEL RTRN
    context['ADP: Decode: Scroll Speed'] = context['_return']

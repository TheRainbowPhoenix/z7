import math

def ADP_Encode_Scroll_Speed(context, global_dbs):
    # Return Type: String
    # VAR_INPUT:
    #   scroll_speed: String
    #   decoded: ADP: Decoded: Scroll Speed
    #   encoded: ADP: Encoded: Formatting: Scroll Speed
    # VAR_TEMP:
    #   _return: String
    if (context['scroll_speed'] == context['decoded'].slowest):
        context['_return'] = context['encoded'].slowest
        # GOTO RTRN (Not supported)
    if (context['scroll_speed'] == context['decoded'].slow):
        context['_return'] = context['encoded'].slow
        # GOTO RTRN (Not supported)
    if (context['scroll_speed'] == context['decoded'].normal):
        context['_return'] = context['encoded'].normal
        # GOTO RTRN (Not supported)
    if (context['scroll_speed'] == context['decoded'].fast):
        context['_return'] = context['encoded'].fast
        # GOTO RTRN (Not supported)
    if (context['scroll_speed'] == context['decoded'].fastest):
        context['_return'] = context['encoded'].fastest
        # GOTO RTRN (Not supported)
    # LABEL RTRN
    context['ADP: Encode: Scroll Speed'] = context['_return']
